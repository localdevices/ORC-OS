# OpenRiverCam OS
OpenRiverCam OS web dashboard for use on personal computer or Raspberry Pi device, operating in the field.

<figure>
    <img src="https://raw.githubusercontent.com/localdevices/pyorc/main/docs/_static/orc_logo_color.svg"
width=100 align="right">
</figure>
<br>

[![License](https://img.shields.io/github/license/localdevices/nodeorc?style=flat)](https://github.com/localdevices/nodeorc/blob/main/LICENSE)

* [What is OpenRiverCam OS](#what-is-openrivercam-os)
* [Installation](#installation)
  * [Installation on Raspberry Pi](#installation-on-raspberry-pi)
  * [Getting the image on the SD card](#getting-the-image-on-the-sd-card)
  * [Getting the image on the Compute Module](#getting-the-image-on-the-compute-module)


> [!TIP]
> Rainbow Sensing is the company behind this entirely Open-Source software framework. We provide ready-to-use images
> with one year of support for a fixed fee. After the first year you may continue using the software on your own devices
> indefinitely. Contact info@rainbowsensing.com for more information.
>
> We also provide training packages for field installation, field survey, image-based processing and principles,
> LiveOpenRiverCam server deployment and maintenance (central API for storage and further use of data).
> You may also contact us for training packages.

# What is OpenRiverCam OS?
OpenRiverCam OS is an entirely open-source dashboard to organize automated measurements of water levels and river flows
using camera videos. It is optimized for use on Raspberry Pi 5 devices and can utilize connected Raspberry Pi cameras.
What can you do with OpenRiverCam OS?
- Set up fully automated processing of videos into water levels and discharges, leveraging the power of
  [PyOpenRiverCam](https://github.com/localdevices/pyorc)
- Set up your own automated water level feeds from external (e.g. web-reporting) or connected devices
- Download your data, directly from the device via the web interface.
- Sync your data Live(!) to a [LiveORC](https://github.com/localdevices/LiveORC) server setup for operational real-time
  use of data in Decision Support Systems or forecast systems.
- Monitor currently ongoing tasks and logs.
- Investigate your time series and results with powerful figures and graphs
- Secure access to your device via a hashed password.
- Stay up-to-date with the latest developments of OpenRiverCam OS through Over-The-Air updates.

> [!NOTE] This README is only meant to instruct how to install OpenRiverCam OS on a device. For more information on how to use
> OpenRiverCam OS, please refer to the [documentation] which is forthcoming. We here do not provide any advice on how to
> build or water proof a device, or how to perform surveys. If you are interested in these topics, please contact us for
> a dedicated training package.

Two approaches to installation are provided.

- Installation of ready-to-use images for Raspberry Pi 5 devices.
- Installation of back end and front end on your own selected device. We provide examples for Debian-based systems only.

# Installation

## Installation on Raspberry Pi

If you have acquired a ready-to-use `.img` file from Rainbow Sensing for use on Raspberry Pi, please follow these
instructions.

### Prerequisites

- A Raspberry Pi 4 or 5 (recommended) device with 8GB of memory. We *DO NOT* support lower Raspberry Pi devices as
  these are not powerful enough and do not work with arm64 images. Please do not contact us for support on Raspberry Pi
  3 or lower devices.

- A suitable power supply. For Raspberry Pi 4, we recommend a 5V 2A power supply. For Raspberry Pi 5, we recommend a
  5V 5A power supply. For connections in the field to a 12V battery (e.g. combined with solar panels), you will require
  a buck step down converter (check your favorite electronics store or web store). Ensure that you find one with 12V
  input (up to 24V if your battery has a higher voltage) that delivers 5V at minimum 3A (2A for Raspberry Pi 4), and
  ideally 5V 5A for a more stable and reliable power.
   supply.

  See: https://www.raspberrypi.com/products/raspberry-pi-5/?variant=raspberry-pi-5-8gb
- An SD card (micro) of good quality (really...try to not underspend on cheap SD cards) of at least 32GB in size; OR
  (better) a Raspberry Pi 5 Compute Module with a carrier board, with 32GB eMMC flash storage. Ensure you have a
  microSD card reader slot on your device, or ensure you get a SD card adapter to fit it in a large SD card reader.

  See: https://www.raspberrypi.com/products/compute-module-5/?variant=cm5-104032
- A laptop or desktop computer with the "Raspberry Pi Imager" installed.

  See: https://www.raspberrypi.com/software/
- A UTP Cable and a free network port on your router or network switch (check the NOTE below if you only have WiFi).

If you want to collect videos with the same device, we also recommend to connect a Raspberry Pi (v3) camera to the device.
The OS will have Raspberry Pi camera libraries pre-installed. Alternatively you may use a suitable
IP Camera that can deliver video files via FTP or SFTP.

See: https://www.raspberrypi.com/products/camera-module-3/

For installation instructions of the Raspberry Pi Imager, please go to https://www.raspberrypi.com/software/

## Getting the image on the SD card
If you have a Raspberry Pi Compute Module, please go to the next section. If you have an SD card, continue here.

At this stage you will not need your Raspberry Pi yet. Just leave it in the box and start the laptop or desktop
computer that has Raspberry Pi Imager installed

1. Put your SD card in a free SD-card reader slot on your laptop or desktop computer that has the Raspberry Pi imager
   installed
2. Download our image from the provided link to a location on your machine that you can find back easily, e.g.
   `C:\User\myuser\Downloads`. The file has the extension `img.gz`. *Do not* unpack this file. This is not necessary.
3. Start the Raspberry Pi imager application.
4. In the field "Raspberry Pi Device", click on "CHOOSE DEVICE" and select your Raspberry Pi device in the list.
   This can only be Raspberry Pi 4 or 5!
5. In the field "Operating System", click on "CHOOSE OS", scroll all the way down and select "Use custom".
   Now navigate to the folder in which you stored the `img.gz` file and double-click it to select it.
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

9. When the application asks "All existing data on '-your selected SD card-' will be erased. Are you sure you want to
   continue?", click on YES.
10. When Raspberry OS Imager asks for your computer's root/super user password, please provide this.

The SD card will now be prepared and verified. This will only take a few minutes. Time for a 🍵 or ☕.

Are you back after your 🍵 or ☕? You should now see a box with title "Write Successful".
If you do not see this, but instead get an error, then likely there is
something wrong with your SD card. Please check the following:

- Is the SD card read only? SD card casings (the larger ones) have a physical read only switch. If this is set to
  read only, please move the physical switch on the SD card to write.
- Is the SD card large enough?
- Is the SD card still ok? SD cards are known to deteriorate in time. This can result in SD cards still being readible
  but not anymore capable of writing. If the SD card is indicated to be read only, even with the physical switch in
  the right place, you probably have a broken SD card.

## Getting the image on the Compute Module
Lorem ipsum

## Getting started with OpenRiverCam OS

1. Take the SD card out of the reader and put it into your Raspberry Pi. Connect the Raspberry Pi's power adapter or
   other power source (e.g. 12V - 5V connection) and connect the UTP cable to your router or network switch. This
   should bring the device onto the same network as your computer.
2. Open a browser and navigate to http://orcos.local. This should bring up the following page. If this page cannot
   be found, then try http://orcos.home or http://orcos

![image](https://github.com/user-attachments/assets/b4339ac7-c05c-4a70-afa7-20030bca4815)

You now have to select your password. *Please ensure you remember this password*. If you forget it, you will not be able
to login anymore and since the service runs locally on the device, you will not be able to perform any recovery.

You should now reach the home page of the device. From here onwards, please follow our documentation pages (forthcoming).

## Configuring for automated field operations

### General settings

### Water level settings
If ORC OS is used to estimate river flow, each video must also have an accompanying water level. If you have a device
installed on the site, or you are able to retrieve water levels from a certain API end point at the location where
your device is installed, you can provide your own a bash or python script that retrieves these water levels at regular
intervals.

![image](https://github.com/user-attachments/assets/5ea48ca0-7846-428e-b8d4-19d809bba78d)

In the form you must fill out:

1. Date and time format as used in the file backup. Not needed if you rely on a script to retrieve values. More on this
   later.
2. File template for water levels. Also not needed if you use the recommended script-based approach.
3. Frequency for running the script. Your provided script will be run after and interval of this value in seconds.
   If the script return identical values (for instance because the API does not yet deliver any new data), then no new
   value will be written to the database. This ensures that you do not get any duplicates that may cause problems
   in the processing chain.
4. Script type. Select PYTHON or BASH.
5. The script itself.

The script must comply to the following rules:

1. The script must be pure bash or python and must be entirely valid. If you provide an invalid script, you will
   receive an error message that hopefully helps you to debug your script. We highly recommend to build and test your
   script first before uploading it.
2. The script can output whatever you want, but at the end a single-line output MUST be returned to the screen as very
   last line with a particular format. This format is `YYYY-MM-DDTHH:MM:SSZ, <value-in-meters>`. If you are used to
   python coding, the datetime string format is `%Y-%m-%dT%H:%M:%SZ, <value-in-meters>`. Here `<value-in-meters>` is the
   water level in the locally defined datum. This could be anything such as a local geo datum, bottom of the stream,
   anything that is logical from a local stand point. Let's have a look at an example.

   For instance for the date 21st of January 2025 and time 15 minutes and 23 seconds past one in the afternoon, we have
   an API that reports a water level of 93.35 meters. This seems a very high value, but as said, here the datum is a
   local geodatum, or mean sea level, and the river may be located about 90 meters above that datum. For this case, your
   script, that retrieves this value from the API must report the following as last line:

   ```bash
   2025-01-21T13:15:23Z, 93.35
   ```
3. The script should be copy-pasted as plain text in the script content box at the bottom.
4. When uploading, you must ensure that the device is at that moment capable to run the script. For instance, when you
   are uploading a script that calls an API, you must be connected to the internet. ORC OS will test the script by
   running it and validating that the script provides the last-line outputs as indicated above.

> [!NOTE]
> As shown, there are two form fields where you can provide as backup, a file format or stored file on disk where water
> levels are attempted to be retrieved. These files must appear in the home folder, configured under disk management in
> the following location:
>
> ```bash
> $HOME_ORC/water_level
> ```
> where $HOME_ORC is the folder, configured under disk management.
>
> This is only used as a backup. If you decide to use this, instead of a direct script, you have to make sure that water
> levels appear in this file yourself, e.g. by preparing a crontab job separately from ORC OS or regularly pushing data.
> to your Raspberry Pi device. Please login via SSH to set this up yourself.

A full example script is provided below. This script calls the open API of the Waterboard Limburg and retrieves a water
level for the site "Hommerich" in their operating area. Note that this is a PYTHON script, hence you MUST select PYTHON
as script type. Go ahead and try it out and see if it gets accepted.

```python
import os
import pandas as pd
import requests

from datetime import datetime, timedelta

# script to load one-day of 15-minute values from waterboard Limburg's API and only print the very last value
# to screen

# below we have a function that calls the latest values. It looks back over a given time interval dt from the current
# time. It will return a http response object.
def retrieve_latest_vals(url, dt=30*60):
    """Retrieve latest values from Water board Limburg API."""
    t_utc = datetime.utcnow()  # get the current time
    dt = timedelta(seconds=dt)
    start_time = t_utc - dt  # get a start time
    start_time_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    params = {
        "$filter": f"DateTime ge {start_time_str}",
        "$orderby": "DateTime"
    }
    # execute the request
    r = requests.get(
        url,
        params=params
    )
    if r.status_code == 200:
        return r
    else:
        # if for instance the site is down or you are not connected...
        raise ValueError(f"Error in response: {r}")

def parse_last_value(body):
    """Get the last value from response JSON data body (e.g. retrieve by response.json()."""
    vals = body["value"]
    if len(vals) == 0:
        raise ValueError("The response did not contain any data! Check if the site was down")
    t = datetime.strptime(vals[-1]["DateTime"], "%Y-%m-%dT%H:%M:%SZ")
    value = vals[-1]["Value"]
    return t, value


url = 'https://www.waterstandlimburg.nl/api/Location(185)/Measurements'  # this is the full end point
dt = 1440 * 60  # full day back looking

# first we retrieve a response from the API end point
r = retrieve_latest_vals(url, dt=dt)
# we retrieve the response body and pass that to retrieve the last value.
t, value = parse_last_value(r.json())
# this is where the magic happens. The line below print EXACTLY the format, required for ORC OS, including the Z
# for UTC+00 time zone and the comma between the time and the value.
print(t.strftime("%Y-%m-%dT%H:%M:%SZ, "), value)
# and that's it. This script will run at the interval selected by you and store the values in the ORC OS database.
```

### For developers

Clone the repository with ssh and move into the cloned folder.

```
git clone git@github.com:localdevices/ORC-OS.git
cd ORC-OS
```

Setup a virtual developers environment and install the package with symbolic links as follows:
```
python -m venv $HOME/venv/orc-os
source $HOME/venv/orc-os/bin/activate
pip install -e .

```

Make sure you install pre-commit hooks so that code is properly linted before pushing.
```
pip install pre-commit
pre-commit install
```
