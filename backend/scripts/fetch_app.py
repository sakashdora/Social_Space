import requests
from bs4 import BeautifulSoup

url = "http://localhost:5173/"
headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

try:
    resp = requests.get(url, headers=headers, timeout=15)
    print(f"Status: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('content-type', 'unknown')}")
    print("\n--- HTML Content (first 5000 chars) ---")
    print(resp.text[:5000])
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # Extract title
    title = soup.find('title')
    print(f"\n--- Title ---")
    print(title.text if title else "No title found")
    
    # Extract meta descriptions
    print("\n--- Meta Tags ---")
    for meta in soup.find_all('meta'):
        print(meta)
    
    # Extract all text
    print("\n--- All Text Content ---")
    text = soup.get_text(separator='\n', strip=True)
    print(text[:3000])
    
except Exception as e:
    print(f"Error: {e}")
