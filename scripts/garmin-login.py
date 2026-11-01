# /// script
# requires-python = ">=3.12"
# dependencies = ["garminconnect>=0.3.18,<0.4", "curl_cffi>=0.11"]
# ///
"""Log in to Garmin Connect once and print the tokens Chalk's Settings, Connections takes.

Garmin's login only lets a real browser through (Cloudflare checks the TLS handshake), so it
runs here, on your machine, with python-garminconnect: curl_cffi gives it a browser's handshake,
and it asks for your MFA code when Garmin wants one. Your password stays in this terminal; the
tokens go to stdout and nowhere else. Run it with `pnpm garmin:login`.
"""

import getpass
import sys

from garminconnect import Garmin


def main() -> int:
    print("Garmin Connect login for Chalk. Your password is not stored.", file=sys.stderr)
    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")
    garmin = Garmin(email, password, prompt_mfa=lambda: input("MFA code: ").strip())
    garmin.login()
    print(
        "\nLogged in. Paste everything below into Chalk, Settings, Connections, Garmin Connect:\n",
        file=sys.stderr,
    )
    print(garmin.client.dumps())
    return 0


if __name__ == "__main__":
    sys.exit(main())
