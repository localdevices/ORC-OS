"""water level read utilities."""

import pandas as pd
import numpy as np
import os
import re
import sys
import subprocess

from datetime import datetime
from typing import Literal

def check_script_security(script_content):
    """
    Check the provided script for basic security vulnerabilities.

    Parameters
    ----------
    script_content : str
        Content of the script to be analyzed.

    Returns
    -------
    dict
        Security report containing issues found and a safety verdict (Bool).
    """
    # Security patterns to check
    risky_functions = [
        r'\b(os\.system)',  # Dangerous os.system calls
        r'\b(subprocess\.(call|run|Popen))',  # Subprocess calls with no restrictions
        r'\b(eval|exec)\b',  # Dynamic code execution
        r'open\s*\(\s*.*\s*,\s*[\'\"]w[\'\"]',  # Opening files for writing
        r'\b(import os)',  # Entire `os` module (potentially dangerous)
        r'\b(import subprocess)',  # Entire `subprocess` module (potentially dangerous)
        r'\b(import shutil)',  # File manipulation risks
        r'\b(import socket)',  # Networking risks
    ]
    risky_commands = [
        r'rm -rf',  # Dangerous file removal
        r'chmod',  # Changing permissions
        r'wget ',  # Downloading files (can be used for malicious purposes)
        r'sudo ',  # Privilege escalation
        r'chown',  # Changing file ownership
    ]

    # Compile patterns
    risky_function_patterns = [re.compile(p) for p in risky_functions]
    risky_command_patterns = [re.compile(p) for p in risky_commands]

    # Initialize report
    issues_found = []
    is_safe = True

    # Check for risky functions
    for pattern in risky_function_patterns:
        matches = pattern.findall(script_content)
        if matches:
            is_safe = False
            issues_found.append(f"Use of risky function detected: {pattern.pattern}, matches: {matches}")

    # Check for risky commands
    for pattern in risky_command_patterns:
        matches = pattern.findall(script_content)
        if matches:
            is_safe = False
            issues_found.append(f"Risky shell command detected: {pattern.pattern}, matches: {matches}")

    # Return security report
    return {
        "is_safe": is_safe,
        "issues_found": issues_found,
    }


def execute_water_level_script(
        script: str,
        script_type: Literal["BASH", "PYTHON"] = "PYTHON"
):
    """Execute a Python or bash script and retrieve the last line of its output as the result.

    The result is expected to be a comma-separated string containing a datetime string
    in %Y%m%dT%H%M%SZ format and a float value.

    Parameters
    ----------
    script : str
        script content (python or bash) to execute. Script must produce a line of output in the format
        %Y-%m-%dT%H:%M:%SZ,<float_value>
    script_type : str, optional {'BASH', 'PYTHON'}
        by default "PYTHON"
    dt : datetime, optional
        datetime to be passed to the script as mandatory argument, by default datetime.now(UTC)

    Returns
    -------
    tuple
        (datetime, float)

    Raises
    ------
    ValueError
        If the output format is invalid or the result cannot be parsed.
    RuntimeError
        If the script execution fails.
    """
    if script_type is None:
        script_type = "PYTHON"
    try:
        if "PYTHON" in str(script_type).upper():
            output = subprocess.run(
                [sys.executable, "-c", script],
                text=True,
                capture_output=True,
            )
        else:
            output = subprocess.run(
                script,
                shell=True,
                capture_output=True
            )
        if output.returncode != 0:
            raise RuntimeError(f"Script execution failed: gives output {output.stderr} with output code {output.returncode}")
        if "PYTHON" in str(script_type).upper():
            last_line = output.stdout.strip().splitlines()[-1]
        else:
            last_line = output.stdout.decode(encoding="utf-8").strip().splitlines()[-1]
        datetime_str, float_str = last_line.split(",")
        # Validate datetime format
        datetime_obj = datetime.strptime(datetime_str, "%Y-%m-%dT%H:%M:%SZ")
        float_value = float(float_str)
        return datetime_obj, float_value

    except (ValueError, IndexError) as e:
        raise ValueError(f"Invalid result format: {last_line}, must be of form %Y-%m-%dT%H:%M:%SZ,<value>") from e


def read_water_level_file(fn, fmt):
    """
    Parse water level file using supplied datetime format

    Parameters
    ----------
    fn : str
        water level file
    fmt : str
        datetime format

    Returns
    -------
    pd.DataFrame
        content of water level file

    """
    date_parser = lambda x: datetime.strptime(x, fmt)
    df = pd.read_csv(
        fn,
        parse_dates=True,
        index_col=[0],
        sep=" ",
        date_parser=date_parser,
        header=None,
        names=["water_level"]
    )
    return df




def get_water_level_file(
        timestamp,
        file_fmt,
        datetime_fmt,
        allowed_dt=None,
):
    """
    Get water level from file(s)

    Parameters
    ----------
    timestamp : datetime
        timestamp to seek in water level file(s)
    file_fmt : str
        water level file template with possible datetime format in between {}
    datetime_fmt : str
        datetime format used inside water level files
    allowed_dt : float
        maximum difference between closest water level and video timestamp

    Returns
    -------
    float
        water level
    """
    if "{" in file_fmt and "}" in file_fmt:
        datetimefmt = file_fmt.split("{")[1].split("}")[0]
        water_level_template = file_fmt.replace(datetimefmt, ":s")
        water_level_fn = water_level_template.format(timestamp.strftime(datetimefmt))
    else:
        # there is no date pattern, so assume the fmt is already a file path
        water_level_fn = file_fmt
    if not (os.path.isfile(water_level_fn)):
        raise IOError(f"water level file {os.path.abspath(water_level_fn)} does not exist.")
    df = read_water_level_file(water_level_fn, fmt=datetime_fmt)
    t = timestamp.strftime("%Y%m%d %H:%M:%S")
    # find the closest match
    i = np.minimum(np.maximum(df.index.searchsorted(t), 0), len(df) - 1)
    # check if value is within limits of time allowed
    if allowed_dt is not None:
        dt_seconds = abs(df.index[i] - timestamp).total_seconds()
        if dt_seconds > allowed_dt:
            raise ValueError(
                f"Timestamp of video {timestamp} is more than {allowed_dt} seconds off from closest "
                f"water level timestamp {df.index[i]}"
            )
    h_a = df.iloc[i].values[0]
    return h_a

