"""Disk management utilities."""

import os
import shutil

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
    free_space = free_space / 10e8

    return free_space


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
