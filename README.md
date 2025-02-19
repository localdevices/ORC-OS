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

9. When the application asks "All existing data on '-your selected SD card-' will be erased. Are you sure you want to 
   continue?", click on YES.
10. When Raspberry OS Imager asks for your password, please provide this.

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

## Getting started with OpenRiverCam OS

1. Take the SD card out of the reader and put it into your Raspberry Pi. Connect the Raspberry Pi's power adapter or
   other power source (e.g. 12V - 5V connection) and connect the UTP cable to your router or network switch. This 
   should bring the device onto the same network as your computer. 
2. Open a browser and navigate to http://nodeorcpi. This should bring up the following page.

![image](https://github.com/user-attachments/assets/b4339ac7-c05c-4a70-afa7-20030bca4815)

You are now ready to configure OpenRiverCam OS. On a Raspberry Pi, you are likely interested in configuring the device
for automated field operations. If this is not the case, then please continue to the "Getting started" section of 
Laptop / Desktop devices.

## Configuring for automated field operations

### General settings

### Water level settings
If ORC OS is used to estimate river flow, each video must also have an accompanying water level. If you have a device
installed on the site, or you are able to retrieve water levels from a certain API end point at the location where
your device is installed, you can provide your own a bash or python script that retrieves these water levels at regular 
intervals. In the form you must fill out:

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

### 
   
