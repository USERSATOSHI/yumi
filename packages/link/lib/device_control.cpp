#include <iostream>
#include <string>

#ifdef _WIN32
    #include <windows.h>
    #include <mmdeviceapi.h>
    #include <endpointvolume.h>
	#include <wrl.h>
	#include <wtypes.h>
	#include <comdef.h>
	#include <shellapi.h>
    #include <PowrProf.h>
    #pragma comment(lib, "PowrProf.lib")
#else
    #include <cstdlib>
#endif

// Portable export macro
#ifdef _WIN32
    #define DEVICECONTROL_API extern "C" __declspec(dllexport)
#else
    #define DEVICECONTROL_API extern "C" __attribute__((visibility("default")))
#endif

#ifdef _WIN32
// RAII wrapper for COM initialization (Windows only)
class ComInitializer {
public:
    ComInitializer() { initialized = SUCCEEDED(CoInitialize(nullptr)); }
    ~ComInitializer() { if (initialized) CoUninitialize(); }
private:
    bool initialized = false;
};
#endif

// === VOLUME ===
DEVICECONTROL_API float getVolume() {
#ifdef _WIN32
    ComInitializer comInit;
    float level = 0.0f;

    IMMDeviceEnumerator* pEnumerator = nullptr;
    IMMDevice* pDevice = nullptr;
    IAudioEndpointVolume* pEndpointVolume = nullptr;

    if (SUCCEEDED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                   __uuidof(IMMDeviceEnumerator), (void**)&pEnumerator)) &&
        SUCCEEDED(pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice)) &&
        SUCCEEDED(pDevice->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_ALL, nullptr, (void**)&pEndpointVolume))) {
        pEndpointVolume->GetMasterVolumeLevelScalar(&level);
    }

    if (pEndpointVolume) pEndpointVolume->Release();
    if (pDevice) pDevice->Release();
    if (pEnumerator) pEnumerator->Release();
    return level;
#else
    // Parse pactl output to get volume
    FILE* pipe = popen("pactl get-sink-volume @DEFAULT_SINK@ | grep -oP '\\d+(?=%)' | head -1", "r");
    if (!pipe) return 0.5f;
    char buffer[128];
    if (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        pclose(pipe);
        return std::stof(buffer) / 100.0f;
    }
    pclose(pipe);
    return 0.5f;
#endif
}

DEVICECONTROL_API void volume(float level) {
#ifdef _WIN32
    ComInitializer comInit;

    IMMDeviceEnumerator* pEnumerator = nullptr;
    IMMDevice* pDevice = nullptr;
    IAudioEndpointVolume* pEndpointVolume = nullptr;

    if (SUCCEEDED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                   __uuidof(IMMDeviceEnumerator), (void**)&pEnumerator)) &&
        SUCCEEDED(pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice)) &&
        SUCCEEDED(pDevice->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_ALL, nullptr, (void**)&pEndpointVolume))) {
        pEndpointVolume->SetMasterVolumeLevelScalar(level, nullptr);
    }

    if (pEndpointVolume) pEndpointVolume->Release();
    if (pDevice) pDevice->Release();
    if (pEnumerator) pEnumerator->Release();
#else
    std::string cmd = "pactl set-sink-volume @DEFAULT_SINK@ " + std::to_string(level*((float)100.0)) + "%";
    system(cmd.c_str());
#endif
}

DEVICECONTROL_API void mute(bool shouldMute) {
#ifdef _WIN32
    ComInitializer comInit;

    IMMDeviceEnumerator* pEnumerator = nullptr;
    IMMDevice* pDevice = nullptr;
    IAudioEndpointVolume* pEndpointVolume = nullptr;

    if (SUCCEEDED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                   __uuidof(IMMDeviceEnumerator), (void**)&pEnumerator)) &&
        SUCCEEDED(pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice)) &&
        SUCCEEDED(pDevice->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_ALL, nullptr, (void**)&pEndpointVolume))) {
        pEndpointVolume->SetMute(shouldMute, nullptr);
    }

    if (pEndpointVolume) pEndpointVolume->Release();
    if (pDevice) pDevice->Release();
    if (pEnumerator) pEnumerator->Release();
#else
    std::string cmd = std::string("pactl set-sink-mute @DEFAULT_SINK@ toggle");
    system(cmd.c_str());
#endif
}

// === BRIGHTNESS ===
DEVICECONTROL_API int getBrightness() {
#ifdef _WIN32
    // Use PowerShell to get current brightness
    FILE* pipe = _popen("powershell.exe -Command \"(Get-WmiObject -Namespace root\\wmi -Class WmiMonitorBrightness).CurrentBrightness\"", "r");
    if (!pipe) return 50;
    char buffer[128];
    if (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        _pclose(pipe);
        return std::stoi(buffer);
    }
    _pclose(pipe);
    return 50;
#else
    // Parse brightnessctl output
    FILE* pipe = popen("brightnessctl -m | cut -d',' -f4 | tr -d '%'", "r");
    if (!pipe) return 50;
    char buffer[128];
    if (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        pclose(pipe);
        return std::stoi(buffer);
    }
    pclose(pipe);
    return 50;
#endif
}

DEVICECONTROL_API void brightness(int level) {
#ifdef _WIN32
    std::wstring command = L"powershell.exe -Command \"(Get-WmiObject -Namespace root\\wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(0," + std::to_wstring(level) + L")\"";
    int result = (int)ShellExecuteW(nullptr, L"open", L"powershell.exe", command.c_str(), nullptr, SW_HIDE);
    if (result <= 32)
    {
        std::cout << "Failed to execute PowerShell command. Error code: " << result << std::endl;
        return;
    }
#else
    std::string cmd = "brightnessctl set " + std::to_string(level) + "%";
    system(cmd.c_str());
#endif
}

// === SYSTEM COMMANDS ===
DEVICECONTROL_API void lock() {
#ifdef _WIN32
    LockWorkStation();
#else
    system("loginctl lock-session");
#endif
}

DEVICECONTROL_API void sleep() {
#ifdef _WIN32
    SetSuspendState(FALSE, TRUE, FALSE);
#else
    system("systemctl suspend");
#endif
}

DEVICECONTROL_API void shutdown() {
#ifdef _WIN32
    system("shutdown /s /t 0");
#else
    system("shutdown now");
#endif
}

DEVICECONTROL_API void restart() {
#ifdef _WIN32
    system("shutdown /r /t 0");
#else
    system("reboot");
#endif
}
