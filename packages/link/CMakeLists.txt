cmake_minimum_required(VERSION 3.16)
project(YumiLink LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --- Dependencies ---
include(FetchContent)
FetchContent_Declare(
  nlohmann_json
  URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(nlohmann_json)

# --- Source files ---
set(SRC_MEDIA lib/media_control.cpp)
set(SRC_DEVICE lib/device_control.cpp)

# --- Windows (cross-compile) ---
if(WIN32 OR MINGW)
    message(STATUS "Building for Windows target")

    add_library(media_control SHARED ${SRC_MEDIA})
    add_library(device_control SHARED ${SRC_DEVICE})

    foreach(target IN ITEMS media_control device_control)
        target_compile_definitions(${target} PRIVATE
            WIN32_LEAN_AND_MEAN
            NOMINMAX
            _WIN32_WINNT=0x0A00
            WINRT_LEAN_AND_MEAN
        )
        target_link_libraries(${target} PRIVATE nlohmann_json::nlohmann_json)
        set_target_properties(${target} PROPERTIES
            SUFFIX ".dll"
            PREFIX ""
        )
    endforeach()
else()
    message(FATAL_ERROR "You are not targeting Windows. Use a MinGW toolchain file.")
endif()

# --- Install (optional) ---
install(TARGETS media_control device_control
        RUNTIME DESTINATION ${CMAKE_CURRENT_SOURCE_DIR})
