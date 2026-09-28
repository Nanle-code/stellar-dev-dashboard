import json
import sys
from urllib.request import Request, urlopen

HORIZON_URL = 'https://horizon-testnet.stellar.org'


def fetch_account(public_key):
    url = f'{HORIZON_URL}/accounts/{public_key}'
    request = Request(url, headers={'Accept': 'application/json'})
    with urlopen(request) as response:
        payload = response.read().decode('utf-8')
        return json.loads(payload)


def main():
    if len(sys.argv) < 2:
        print('Usage: python docs/api/examples/python/horizon_account_example.py <PUBLIC_KEY>')
        sys.exit(1)

    public_key = sys.argv[1]
    try:
        account = fetch_account(public_key)
        print(json.dumps(account, indent=2))
    except Exception as error:
        print('Failed to fetch account:', error)
        sys.exit(1)


if __name__ == '__main__':
    main()
