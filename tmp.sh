#!/bin/env bash

build_firefox() {
    set -e

    echo "Starting extension build process..."

    if [ -d "dist" ]; then
        echo "Removing existing 'dist' directory..."
        rm -rf dist
    fi

    echo "Creating new 'dist' directory..."
    mkdir dist

    echo "Moving contents from 'Common' to 'dist'..."
    cp -r Common/* dist/

    echo "Replacing 'chrome' with 'browser' in all files..."
    find ./dist -type f -exec grep -Iq . {} \; -print | xargs sed -i 's/chrome/browser/g'

    echo "Copying 'Firefox' files to 'dist'..."
    cp -r Firefox/* dist/

    echo "Build complete. The 'dist' directory is ready."
}

build_chrome() {
   # Exit immediately if a command exits with a non-zero status.
    set -e

    echo "Starting extension build process..."

    # 1. Remove the old 'dist' directory if it exists to ensure a clean build.
    if [ -d "dist" ]; then
        echo "Removing existing 'dist' directory..."
        rm -rf dist
    fi

    # 2. Create a new, empty 'dist' directory.
    echo "Creating new 'dist' directory..."
    mkdir dist

    # 3. Move all contents from 'Common' to 'dist'.
    echo "Moving contents from 'Common' to 'dist'..."
    cp -r Common/* dist/

    echo "Copying 'Chrome' files to 'dist'..."
    cp -r Chrome/* dist/

    echo "Build complete. The 'dist' directory is ready."
}

if [ -z "$1" ]; then
    echo "Choose Firefox or Chrome" 1>&2
    exit 1
fi


case $1 in 
    [fF]irefox|f|F)
        build_firefox
        ;;
    [cC]hrome|c|C)
        build_chrome
        ;;
    *)
        echo "Choose Firefox or Chrome" 1>&2
        exit 1
        ;;
esac
