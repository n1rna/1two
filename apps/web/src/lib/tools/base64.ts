export function encodeBase64(text: string, urlSafe: boolean = false): string {
  let encoded = btoa(unescape(encodeURIComponent(text)));
  if (urlSafe) {
    encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return encoded;
}

export function decodeBase64(text: string, urlSafe: boolean = false): string {
  let input = text.trim();
  if (urlSafe) {
    input = input.replace(/-/g, "+").replace(/_/g, "/");
    while (input.length % 4) input += "=";
  }
  return decodeURIComponent(escape(atob(input)));
}
