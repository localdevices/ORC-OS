# OpenRiverCam OS
OpenRiverCam OS web dashboard for use on personal computer or Raspberry Pi device, operating in the field. 

<figure>
    <img src="https://raw.githubusercontent.com/localdevices/pyorc/main/docs/_static/orc_logo_color.svg"
width=100 align="right">
</figure>
<br>

[![License](https://img.shields.io/github/license/localdevices/nodeorc?style=flat)](https://github.com/localdevices/nodeorc/blob/main/LICENSE)

> [!CAUTION]
> The OpenRiverCam OS is currently in development. As long as this is the case, please do not expect a fully 
> working version here. Only when a formal release is present can you start relying on the OpenRiverCam OS 
> for your operational work. Until then, please use:
> * Ad-hoc processing: pyORC command-line interface, see https://openrivercam.org
> * Automated on-site processing: NodeORC daemon, see https://github.com/localdevices/nodeorc.git

* [What is OpenRiverCam OS](#what-is-openrivercam-os)
* [Installation](#installation)
  * [Installation on Raspberry Pi](#installation-on-raspberry-pi)

# What is OpenRiverCam OS?
Lorem Ipsum

# Installation

## Installation on Raspberry Pi

We have prepared Bookworm images for Raspberry Pi 4 and 5 devices.

### Prerequisites

- A Raspberry Pi 4 or 5 device. We do not support lower Raspberry Pi devices as these are not powerful enough and do not
  work with arm64 images.
- An SD card of good quality (really...try to not underspend on cheap SD cards) of at least 16GB in size.
- A laptop or desktop computer with the "Raspberry Pi Imager" installed.
- A UTP Cable and a free network port on your router or network switch (check the NOTE below if you only have WiFi).

If you want to collect videos with the same device, we also recommend to connect a Raspberry Pi camera to the device.
The OS will have Raspberry Pi camera libraries pre-installed.

For installation instructions of the Raspberry Pi Imager, please go to https://www.raspberrypi.com/software/

## Getting the image on the SD card
At this stage you will not need your Raspberry Pi yet. Just leave it in the box and start the laptop or desktop
computer that has Raspberry Pi Imager installed

1. Put your SD card in a free SD-card reader slot on your laptop or desktop computer that has the Raspberry Pi imager
   installed
2. Download our image from https://....... to a location on your machine that you can find back easily, e.g. 
   `C:\User\myuser\Downloads`. The file has the extension `img.gz`. Do not unpack this file. This is not necessary.
3. Start the Raspberry Pi imager application.
4. In the field "Raspberry Pi Device", click on "CHOOSE DEVICE" and select your Raspberry Pi device in the list. T
   this can only be Raspberry Pi 4 or 5!
5. In the field "Operating System", click on "CHOOSE OS", scroll all the way down and select "Use custom".
   Now navigate to the folder in which you stored the `img.gz` file and double click it to select it.
6. In the field "Storage", click on "CHOOSE STORAGE". Select the SD card, typically called something like "Internal SD 
   card reader."
7. Click on "NEXT"
8. When the application asks "Would you like to apply OS customisation settings?", click on NO.

> [!TIP]
> If you do not have a UTP cable or free UTP slot conveniently nearby but instead want to rely on WiFi, then select 
> "EDIT SETTINGS" and follow the instruction below.
> * In the "GENERAL" tab, activate "Configure wireless LAN"
> * type in the exact capital sensitive (!) name of your WiFi SSID in the SSID field.
> * type the exact capital sensitive password in the password field.
> * Choose your 2-letter country code in the Wireless LAN country dropdown menu.
> * Click on "SAVE"
> * Click on "YES".

9. When the application asks "All existing data on \'<your selected SD card>\' will be erased. Are you sure you want to 
   continue?", click on YES.
10. When Raspberry OS Imager asks for your password, please provide this.

The SD card will now be prepared and verified. This will only take a few minutes. Time for a ☕.

Are you back after your ☕? You should now see a box with title "Write Successful". 
If you do not see this, but instead get an error, then likely there is
something wrong with your SD card. Please check the following:

- Is the SD card read only? SD card casings (the larger ones) have a physical read only switch. If this is set to 
  read only, please move the physical switch on the SD card to write.
- Is the SD card large enough? 
- Is the SD card still ok? SD cards are known to deteriorate in time. This can result in SD cards still being readible 
  but not anymore capable of writing. If the SD card is indicated to be read only, even with the physical switch in 
  the right place, you probably have a broken SD card.

## Getting started with OpenRiverCam OS

1. Take the SD card out of the reader and put it into your Raspberry Pi. Connect the Raspberry Pi's power adapter or
   other power source (e.g. 12V - 5V connection) and connect the UTP cable to your router or network switch. This 
   should bring the device onto the same network as your computer. 
2. Open a browser and navigate to http://nodeorcpi. This should bring up the following page.

You are now ready to set up OpenRiverCam OS. On a Raspberry Pi, you are likely interested in setting up the device
for automated field operations. If this is not the case, then please continue to the "Getting started" section of 
Laptop / Desktop devices.




   