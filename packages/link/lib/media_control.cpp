#include <iostream>
#include <string>
#include <chrono>
#include <future>
#include <mutex>
#include <memory>
#include <nlohmann/json.hpp>
#include <cstdint>
#include <string>
#include <vector>

using json = nlohmann::json;

// Platform detection
#if defined(_WIN32) || defined(_WIN64)
    #define PLATFORM_WINDOWS true
    #include <windows.h>
    #include <winrt/Windows.Foundation.h>
    #include <winrt/Windows.Media.Control.h>
    #include <winrt/Windows.Storage.Streams.h>
    using namespace winrt;
    using namespace Windows::Media::Control;
    using namespace Windows::Foundation;
    using namespace Windows::Storage::Streams;
    #define EXPORT_API __declspec(dllexport)
#else
    #define PLATFORM_UNIX true
    #include <cstdio>
    #include <array>
    #include <memory>
    #include <stdexcept>
    #include <string>
    #include <sstream>
    #define EXPORT_API __attribute__((visibility("default")))
#endif

// Base64 encoding table
static const char base64_chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Base64 encode function
std::string base64_encode(const std::vector<uint8_t>& data) {
    std::string result;
    result.reserve(((data.size() + 2) / 3) * 4);
    
    for (size_t i = 0; i < data.size(); i += 3) {
        uint32_t n = static_cast<uint32_t>(data[i]) << 16;
        if (i + 1 < data.size()) n |= static_cast<uint32_t>(data[i + 1]) << 8;
        if (i + 2 < data.size()) n |= static_cast<uint32_t>(data[i + 2]);
        
        result += base64_chars[(n >> 18) & 0x3F];
        result += base64_chars[(n >> 12) & 0x3F];
        result += (i + 1 < data.size()) ? base64_chars[(n >> 6) & 0x3F] : '=';
        result += (i + 2 < data.size()) ? base64_chars[n & 0x3F] : '=';
    }
    
    return result;
}

// Artwork cache structure
struct ArtworkCache {
    std::string trackKey;      // title + artist combined
    std::string base64Data;    // cached base64 artwork
    bool sentForCurrentTrack;  // whether we've sent artwork for this track
    std::mutex mutex;
    
    ArtworkCache() : sentForCurrentTrack(false) {}
};

static ArtworkCache g_artworkCache;

// Format duration from seconds to mm:ss format
std::string format_duration(double seconds) {
    if (seconds < 0) {
        return "00:00";
    }
    
    int minutes = static_cast<int>(seconds) / 60;
    int secs = static_cast<int>(seconds) % 60;
    
    char buffer[16];
#ifdef PLATFORM_WINDOWS
    sprintf_s(buffer, "%02d:%02d", minutes, secs);
#else
    snprintf(buffer, sizeof(buffer), "%02d:%02d", minutes, secs);
#endif
    return std::string(buffer);
}

#ifdef PLATFORM_WINDOWS
// Track position tracker class for Windows
class TrackPositionTracker {
public:
    TrackPositionTracker()
        : start_time(std::chrono::system_clock::now()),
          initial_position(0),
          old_position(0),
          total_duration(0),
          last_playback_state(""),
          paused_position(0),
          start_time_initialized(false) {}

    std::pair<double, double> update_from_timeline(const GlobalSystemMediaTransportControlsSessionTimelineProperties& timeline, const std::string& playback_status) {
        auto current_time = std::chrono::system_clock::now();
        double position = 0;
        
        if (timeline.Position().count() != 0) {
            position = timeline.Position().count() / 10000000.0; // Convert 100-nanosecond units to seconds
        } else {
            return {0, total_duration};
        }

        // Update total duration if available
        if (timeline.EndTime().count() != 0) {
            total_duration = timeline.EndTime().count() / 10000000.0;
        }

        // Check playback status
        bool is_playing = (playback_status == "Playing");
        bool was_playing = (last_playback_state == "Playing");

        // First initialization
        if (!start_time_initialized) {
            start_time = current_time;
            initial_position = position;
            old_position = position;
            last_playback_state = playback_status;
            start_time_initialized = true;
            return {position, total_duration};
        }

        // Handle state changes
        if (is_playing && !was_playing) {
            // Resuming playback
            start_time = current_time;
            initial_position = (paused_position > 0) ? paused_position : position;
        } else if (!is_playing && was_playing) {
            // Just paused
            auto paused_at = current_time;
            double elapsed = std::chrono::duration<double>(paused_at - start_time).count();
            paused_position = initial_position + elapsed;
        }

        last_playback_state = playback_status;

        // Calculate current position
        if (is_playing) {
            double elapsed = 1.0;
            if (old_position == position) {
                // No change in position, return last known position
                initial_position = initial_position + elapsed;
            } else {
                initial_position = position + 1.0;
                old_position = position;
            }

            return {std::min(initial_position, total_duration), total_duration};
        } else {
            // Return last known position when paused
            return {(paused_position > 0) ? paused_position : position, total_duration};
        }
    }

private:
    std::chrono::system_clock::time_point start_time;
    double initial_position;
    double old_position;
    double total_duration;
    std::string last_playback_state;
    std::chrono::system_clock::time_point paused_at;
    double paused_position;
    bool start_time_initialized;
};

// Global tracker instance for Windows
static TrackPositionTracker global_tracker;
#else
// Unix utility to execute commands and get output
std::string exec(const char* cmd) {
    std::array<char, 128> buffer;
    std::string result;
    std::unique_ptr<FILE, decltype(&pclose)> pipe(popen(cmd, "r"), pclose);
    
    if (!pipe) {
        throw std::runtime_error("popen() failed!");
    }
    
    while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
        result += buffer.data();
    }
    
    // Remove trailing newline if present
    if (!result.empty() && result[result.length()-1] == '\n') {
        result.erase(result.length()-1);
    }
    
    return result;
}

// Track position tracker for Unix (simpler, relies on playerctl)
class UnixTrackPositionTracker {
public:
    std::pair<double, double> getCurrentPosition() {
        try {
			// check if there is a player running
			std::string player_status = exec("playerctl status");
			if (player_status.empty() || player_status == "No players found") {
				return {0.0, 0.0};
			}

            // Get position in seconds
            std::string position_str = exec("playerctl position");
            double position = std::stod(position_str);
            
            // Get length in seconds
            std::string length_str = exec("playerctl metadata mpris:length");
            // Convert from microseconds to seconds
            double length = std::stod(length_str) / 1000000.0;
            
            return {position, length};
        } catch (const std::exception& ex) {
            std::cerr << "Error getting position: " << ex.what() << std::endl;
            return {0.0, 0.0};
        }
    }
};

// Global tracker instance for Unix
static UnixTrackPositionTracker unix_tracker;
#endif

// FFI Exports
extern "C" {
    // Play media
    EXPORT_API bool playMedia() {
#ifdef PLATFORM_WINDOWS
        try {
            auto play_async = []() -> fire_and_forget {
                auto manager = co_await GlobalSystemMediaTransportControlsSessionManager::RequestAsync();
                auto current_session = manager.GetCurrentSession();
                
                if (current_session) {
                    co_await current_session.TryPlayAsync();
                }
            };
            
            play_async();
            return true;
        } catch (const std::exception& ex) {
            std::cerr << "Error in playMedia: " << ex.what() << std::endl;
            return false;
        }
#else
        try {
            int result = system("playerctl play");
            return (result == 0);
        } catch (const std::exception& ex) {
            std::cerr << "Error in playMedia: " << ex.what() << std::endl;
            return false;
        }
#endif
    }
    
    // Pause media
    EXPORT_API bool pauseMedia() {
#ifdef PLATFORM_WINDOWS
        try {
            auto pause_async = []() -> fire_and_forget {
                auto manager = co_await GlobalSystemMediaTransportControlsSessionManager::RequestAsync();
                auto current_session = manager.GetCurrentSession();
                
                if (current_session) {
                    co_await current_session.TryPauseAsync();
                }
            };
            
            pause_async();
            return true;
        } catch (const std::exception& ex) {
            std::cerr << "Error in pauseMedia: " << ex.what() << std::endl;
            return false;
        }
#else
        try {
            int result = system("playerctl pause");
            return (result == 0);
        } catch (const std::exception& ex) {
            std::cerr << "Error in pauseMedia: " << ex.what() << std::endl;
            return false;
        }
#endif
    }
    
    // Next track
    EXPORT_API bool nextTrack() {
#ifdef PLATFORM_WINDOWS
        try {
            auto next_async = []() -> fire_and_forget {
                auto manager = co_await GlobalSystemMediaTransportControlsSessionManager::RequestAsync();
                auto current_session = manager.GetCurrentSession();
                
                if (current_session) {
                    co_await current_session.TrySkipNextAsync();
                }
            };
            
            next_async();
            return true;
        } catch (const std::exception& ex) {
            std::cerr << "Error in nextTrack: " << ex.what() << std::endl;
            return false;
        }
#else
        try {
            int result = system("playerctl next");
            return (result == 0);
        } catch (const std::exception& ex) {
            std::cerr << "Error in nextTrack: " << ex.what() << std::endl;
            return false;
        }
#endif
    }
    
    // Previous track
    EXPORT_API bool previousTrack() {
#ifdef PLATFORM_WINDOWS
        try {
            auto prev_async = []() -> fire_and_forget {
                auto manager = co_await GlobalSystemMediaTransportControlsSessionManager::RequestAsync();
                auto current_session = manager.GetCurrentSession();
                
                if (current_session) {
                    co_await current_session.TrySkipPreviousAsync();
                }
            };
            
            prev_async();
            return true;
        } catch (const std::exception& ex) {
            std::cerr << "Error in previousTrack: " << ex.what() << std::endl;
            return false;
        }
#else
        try {
            int result = system("playerctl previous");
            return (result == 0);
        } catch (const std::exception& ex) {
            std::cerr << "Error in previousTrack: " << ex.what() << std::endl;
            return false;
        }
#endif
    }
    
    // Seek to position
    EXPORT_API bool seekTo(const char* position_cstr) {
#ifdef PLATFORM_WINDOWS
        try {
            auto seek_async = [position_cstr]() -> fire_and_forget {
                try {
                    std::string position_str(position_cstr);  // Now happens inside lambda
                    int64_t pos = std::stoll(position_str) * 10000000;
    
                    auto manager = co_await GlobalSystemMediaTransportControlsSessionManager::RequestAsync();
                    auto current_session = manager.GetCurrentSession();
    
                    if (current_session) {
                        auto timeline = current_session.GetTimelineProperties();
                        double total_duration = 0;
    
                        if (timeline.EndTime().count() != 0) {
                            total_duration = static_cast<double>(timeline.EndTime().count()) / 10000000.0;
                        }
    
                        std::cerr << "Total Duration: " << total_duration << " seconds" << std::endl;
                        std::cerr << "Requested Position: " << position_str << " seconds" << std::endl;
                        std::cerr << "Requested Position (ticks): " << pos << " ticks" << std::endl;
    
                        if (total_duration >= 0 && pos >= 0 && pos <= static_cast<int64_t>(timeline.EndTime().count())) {
                            co_await current_session.TryChangePlaybackPositionAsync(pos);
                            std::cerr << "Seek successful to: " << pos << " ticks" << std::endl;
                        } else {
                            std::cerr << "Invalid position: " << pos << " outside range" << std::endl;
                        }
                    }
                } catch (const std::exception& ex) {
                    std::cerr << "Exception in async seek: " << ex.what() << std::endl;
                }
            };
    
            seek_async();
            return true;
        } catch (const std::exception& ex) {
            std::cerr << "Error in seekTo wrapper: " << ex.what() << std::endl;
            return false;
        }
#else
        try {
            std::string position_sec(position_cstr);
            std::string cmd = "playerctl position " + position_sec;
            std::cerr << "Executing command: " << cmd << std::endl;
            int result = system(cmd.c_str());
            return (result == 0);
        } catch (const std::exception& ex) {
            std::cerr << "Error in seekTo: " << ex.what() << std::endl;
            return false;
        }
#endif
    }
        
    // Get current track info
    EXPORT_API const char* getCurrentTrackInfo() {
        static std::string result_json;
        static std::mutex result_mutex;
        
        try {
#ifdef PLATFORM_WINDOWS
            // Create a future to handle the async operation
            auto get_info = std::async(std::launch::async, []() -> json {
                try {
                    winrt::init_apartment();
                    
                    // Get the media session
                    auto manager_task = GlobalSystemMediaTransportControlsSessionManager::RequestAsync();
                    auto manager = manager_task.get();
                    auto current_session = manager.GetCurrentSession();
                    
                    if (!current_session) {
                        json error;
                        error["error"] = "No media is currently playing";
                        return error;
                    }
                    
                    // Get media properties
                    auto info_task = current_session.TryGetMediaPropertiesAsync();
                    auto info = info_task.get();
                    
                    // Get timeline and playback info
                    auto timeline = current_session.GetTimelineProperties();
                    auto playback_info = current_session.GetPlaybackInfo();
                    std::string playback_status;
                    
                    // Convert playback status enum to string
                    switch (playback_info.PlaybackStatus()) {
                        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed:
                            playback_status = "Closed";
                            break;
                        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Changing:
                            playback_status = "Changing";
                            break;
                        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped:
                            playback_status = "Stopped";
                            break;
                        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing:
                            playback_status = "Playing";
                            break;
                        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused:
                            playback_status = "Paused";
                            break;
                        default:
                            playback_status = "Unknown";
                            break;
                    }
                    
                    // Update position tracker
                    auto [current_position, total_duration] = global_tracker.update_from_timeline(timeline, playback_status);
                    
                    // Get title and artist
                    std::string title = winrt::to_string(info.Title());
                    std::string artist = winrt::to_string(info.Artist());
                    std::string trackKey = title + "|" + artist;
                    
                    // Create result JSON
                    json result;
                    result["title"] = title;
                    result["artist"] = artist;
                    result["duration"] = format_duration(total_duration);
                    result["current_position"] = format_duration(current_position);
                    result["raw_duration_seconds"] = total_duration;
                    result["raw_position_seconds"] = current_position;
                    result["playback_status"] = playback_status;
                    
                    // Handle artwork - only send on track change
                    {
                        std::lock_guard<std::mutex> lock(g_artworkCache.mutex);
                        
                        // If stopped or closed, send null and clear cache
                        if (playback_status == "Stopped" || playback_status == "Closed") {
                            result["artwork"] = nullptr;
                            g_artworkCache.trackKey = "";
                            g_artworkCache.base64Data = "";
                            g_artworkCache.sentForCurrentTrack = false;
                        }
                        // Check if track changed
                        else if (trackKey != g_artworkCache.trackKey) {
                            // New track - fetch artwork
                            g_artworkCache.trackKey = trackKey;
                            g_artworkCache.sentForCurrentTrack = false;
                            g_artworkCache.base64Data = "";
                            
                            try {
                                auto thumbnail = info.Thumbnail();
                                if (thumbnail) {
                                    // Open the stream and read the thumbnail
                                    auto streamRef = thumbnail.OpenReadAsync().get();
                                    auto size = static_cast<uint32_t>(streamRef.Size());
                                    
                                    if (size > 0 && size < 10 * 1024 * 1024) { // Max 10MB
                                        Buffer buffer(size);
                                        auto bytesRead = streamRef.ReadAsync(buffer, size, InputStreamOptions::None).get();
                                        
                                        // Copy to vector
                                        std::vector<uint8_t> imageData(bytesRead.Length());
                                        memcpy(imageData.data(), bytesRead.data(), bytesRead.Length());
                                        
                                        // Get content type
                                        std::string contentType = winrt::to_string(streamRef.ContentType());
                                        if (contentType.empty()) contentType = "image/png";
                                        
                                        // Encode to base64 data URL
                                        g_artworkCache.base64Data = "data:" + contentType + ";base64," + base64_encode(imageData);
                                    }
                                    streamRef.Close();
                                }
                            } catch (...) {
                                // Thumbnail fetch failed, leave empty
                                g_artworkCache.base64Data = "";
                            }
                            
                            // Send artwork on track change (even if empty/null)
                            if (!g_artworkCache.base64Data.empty()) {
                                result["artwork"] = g_artworkCache.base64Data;
                            } else {
                                result["artwork"] = nullptr;
                            }
                            g_artworkCache.sentForCurrentTrack = true;
                        }
                        // Same track - don't include artwork field (omit it entirely)
                        // The client should keep showing the last received artwork
                    }
                    
                    return result;
                } catch (const std::exception& ex) {
                    json error;
                    error["error"] = ex.what();
                    return error;
                }
            });
            
            // Get the result from the future
            json track_info = get_info.get();
#else
			std::string player_status = exec("playerctl status");
			if (player_status.empty() || player_status == "No players found") {
				json error;
				error["error"] = "No media is currently playing";
				return error.dump().c_str();
			}

            json track_info;
            try {
                // Get track info using playerctl
                std::string title = exec("playerctl metadata title");
                std::string artist = exec("playerctl metadata artist");
                std::string status = exec("playerctl status");
                std::string artwork = exec("playerctl metadata mpris:artUrl");
                
                // Get position and duration
                auto [position, duration] = unix_tracker.getCurrentPosition();
                
                // Create result JSON
                track_info["title"] = title;
                track_info["artist"] = artist;
                track_info["duration"] = format_duration(duration);
                track_info["current_position"] = format_duration(position);
                track_info["raw_duration_seconds"] = duration;
                track_info["raw_position_seconds"] = position;
                track_info["playback_status"] = status;
                
                // Add artwork URL if available
                if (!artwork.empty() && artwork != "No players found") {
                    track_info["artwork"] = artwork;
                }
            } catch (const std::exception& ex) {
                track_info["error"] = ex.what();
            }
#endif
            
            // Lock the mutex and update the result string
            {
                std::lock_guard<std::mutex> lock(result_mutex);
                result_json = track_info.dump();
            }
            
            return result_json.c_str();
        } catch (const std::exception& ex) {
            // Handle any exception in the main thread
            std::lock_guard<std::mutex> lock(result_mutex);
            json error;
            error["error"] = ex.what();
            result_json = error.dump();
            return result_json.c_str();
        }
    }
}

#ifdef PLATFORM_WINDOWS
// DLL entry point for Windows
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
        // Initialize WinRT
        winrt::init_apartment();
        break;
    case DLL_THREAD_ATTACH:
        break;
    case DLL_THREAD_DETACH:
        break;
    case DLL_PROCESS_DETACH:
        // Uninitialize WinRT
        winrt::uninit_apartment();
        break;
    }
    return TRUE;
}
#else
// Library initialization for Unix
__attribute__((constructor))
static void initialize() {
    // Check if playerctl is installed
    int result = system("which playerctl > /dev/null 2>&1");
    if (result != 0) {
        std::cerr << "Warning: playerctl is not installed. Media control functions will not work.\n";
        std::cerr << "Please install playerctl using your package manager (e.g., 'sudo apt install playerctl').\n";
    }
}

// Library cleanup for Unix
__attribute__((destructor))
static void cleanup() {
    // Any cleanup needed
}
#endif