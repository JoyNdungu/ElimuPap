import subprocess
import sys

def install(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

if __name__ == '__main__':
    try:
        import multipart
        print("python-multipart already installed.")
    except ImportError:
        print("Installing python-multipart...")
        install("python-multipart")
        print("Installation complete.")
