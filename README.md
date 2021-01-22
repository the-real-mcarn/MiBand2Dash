# MiBand2Dash

Simple electron dashboard for saving / storing MiBand 2 data using the MiBand-JS library. 

## Installation

### Pre-built

* MiBand2Dash is portable, go over to releases and download the package for your operating system

### Source

* Download this repo
* Run `npm install`, note that this might take some time
* Run `npm start` to start the program

## Notes

* This program is only compatible with MiBands up to version 3. 
* Windows users need to install the [libUSB](https://libusb.info/) drivers for their bluetooth adapter otherwise the program will refuse to start. The easiest way to do this is using [Zadig](https://zadig.akeo.ie/), note that the original driver will be replaced and Windows will no longer recognise your adapter as a bluetooth device. It is recommended that you either use a seperate bluetooth adapter or backup the original drivers. 
