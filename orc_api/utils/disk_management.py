"""Disk management utilities."""

import os
import shutil
import time
from datetime import datetime

import numpy as np


# functions to manage that disk space remains below a threshold
def get_free_space(path_dir):
    """Calculate free space in path_dir in GB.

    Parameters
    ----------
    path_dir : str, path-like
        root dir from which to check for space.
    logger : Logger
        logging object

    Returns
    -------
    float

    """
    # --- Get size of HDD ---
    f = os.statvfs(path_dir)
    free_space = f.f_frsize * f.f_bavail
    # in GB
    free_space = free_space / 1024**3
    return free_space


def get_timestamp(
    fn,
    parse_from_fn,
    fn_fmt,
):
    """Find time stamp from file name using expected file name template with datetime fmt.

    Parameters
    ----------
    fn : str
        filename path
    parse_from_fn : bool
        If set to True, filename is used to parse timestamp using a filename template,
        if False, timestamp is retrieved from the last change datetime of the file
    fn_fmt : str
        filename template with datetime format between {}

    Returns
    -------
    datetime
        timestamp of video file

    """
    if parse_from_fn:
        datetime_fmt = fn_fmt.split("{")[1].split("}")[0]
        fn_template = fn_fmt.replace(datetime_fmt, "")
        prefix, suffix = fn_template.split("{}")
        if prefix not in fn or suffix not in fn:
            raise ValueError(
                f"File naming of video {fn} does not follow the template {fn_fmt}. Please change daemon settings"
            )
        if len(prefix) > 0:
            timestr = fn.split(prefix)[1]
        else:
            timestr = os.path.basename(fn)
        if len(suffix) > 0:
            timestr = timestr.split(suffix)[0]
        try:
            timestamp = datetime.strptime(timestr, datetime_fmt)
        except ValueError:
            raise ValueError(
                f"datetime string {timestr} does not follow the datetime format {datetime_fmt}. "
                f"Please change daemon settings"
            )
    else:
        timestamp = datetime.fromtimestamp(os.path.getmtime(fn))
    return timestamp


def is_file_size_changing(fn, delay=1):
    """Check if the file size changes over a certain amount of time.

    Can be used to check if a file is being written into by another process.

    Parameters
    ----------
    fn : str
        path to file
    delay : float, optional
        amount of delay time to check if file size changes

    Returns
    -------
    bool
        True (False) if file does (not) change

    """
    if not (os.path.isfile(fn)):
        raise IOError(f"File {fn} does not exist")
    # check if file is being written into, by checking changes in file size over a delay
    size1 = os.path.getsize(fn)
    time.sleep(delay)
    if size1 != os.path.getsize(fn):
        return True
    else:
        return False


def scan_folder(incoming, clean_empty_dirs=True, suffix=None):
    """Scan incoming path for appearing files.

    This function removes empty directories automatically.

    Parameters
    ----------
    incoming : list or str, path-like
        folder or multiple folder containing relevant files
    clean_empty_dirs : bool, optional
        setting to cleanup found empty dirs, defaults to True
    suffix : str, optional
        suffix to use for finding relevant files

    Returns
    -------
    file_paths : List
        list of paths to files found in the folder

    """
    if not isinstance(incoming, list):
        incoming = [incoming]
    # ensure incoming is not byte encoded
    incoming = [incoming if type(incoming) is not bytes else incoming.decode() for incoming in incoming]
    file_paths = []
    for folder in incoming:
        if not folder:
            return file_paths
        # ensure folder is always of str type
        if type(folder) is bytes:
            folder = folder.decode()
        for root, paths, files in os.walk(folder):
            if clean_empty_dirs:
                if len(paths) == 0 and len(files) == 0:
                    # remove the empty folder if it is not the top folder
                    if os.path.abspath(root) != os.path.abspath(folder):
                        os.rmdir(root)
            for f in files:
                full_path = os.path.join(root, f)
                if suffix is not None:
                    if full_path[-len(suffix) :] == suffix:
                        file_paths.append(full_path)
                else:
                    file_paths.append(full_path)
    return file_paths


def delete_folder(path_to_folder, logger):
    """Delete a complete folder with all contents."""
    try:
        shutil.rmtree(path_to_folder)
        logger.info("Removed folder: " + str(path_to_folder))
        return True
    except Exception:
        logger.error("Could not remove directory" + str(path_to_folder), exc_info=True)
        return False


def delete_file(path_to_file, logger):
    """Delete a file."""
    try:
        os.remove(path_to_file)
        logger.info(f"Purged {path_to_file}")
        return True
    except Exception:
        logger.error("Could not remove file" + str(path_to_file), exc_info=True)
        return False


def purge(paths, free_space, min_free_space, logger, home="/home"):
    """Purge files from disk until free space is sufficient again."""
    # check for files
    fns = scan_folder(paths)
    # get timestamp of files
    timestamps = [os.path.getmtime(fn) for fn in fns]
    # sort all on time stamps
    idx = np.argsort(timestamps)
    fns = list(np.array(fns)[idx])
    timestamps = list(np.array(timestamps)[idx])
    cur_idx = 0
    while free_space < min_free_space:
        if cur_idx > len(fns) - 1:
            # apparently there is no way to free up more space than needed, return a serious error
            logger.warning(
                f"No files can be deleted, but free space {free_space} GB is lower than threshold {min_free_space} GB"
            )
            return False
        # keep on removing files until the free space is sufficient again
        if not (delete_file(fns[cur_idx], logger=logger)):
            logger.warning(f"File {fns[cur_idx]} could not be deleted, skipping...")
        free_space = get_free_space(home)
        # continue with the next file in the list
        cur_idx += 1
    return True
