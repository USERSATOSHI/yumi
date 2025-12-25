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
