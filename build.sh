#!/bin/env bash

<<NOTICE
This script is deprecated.  Please use package.json to build distribution version

If you must use this script for testing, just run
./build.sh [platform]

where platform may be chrome or firefox

run ./build.sh clean to clean
NOTICE

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
    [cC]lean)
        echo "Cleaning up dist..."
        [ -d dist ] && rm -rf dist
        ;;
    *)
        echo "Choose Firefox or Chrome" 1>&2
        exit 1
        ;;
esac
