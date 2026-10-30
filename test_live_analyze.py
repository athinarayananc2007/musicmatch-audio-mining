import urllib.request, ssl, wave, struct, io

ctx = ssl.create_default_context()
buf = io.BytesIO()
with wave.open(buf, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(22050)
    for i in range(22050):
        w.writeframes(struct.pack('<h', int(10000 * ((i % 50) - 25) / 25)))
wav_data = buf.getvalue()

boundary = '----Boundary12345'
body = (
    b'--' + boundary.encode() + b'\r\n'
    b'Content-Disposition: form-data; name="files"; filename="sample.wav"\r\n'
    b'Content-Type: audio/wav\r\n\r\n' + wav_data + b'\r\n'
    b'--' + boundary.encode() + b'\r\n'
    b'Content-Disposition: form-data; name="clusters"\r\n\r\n3\r\n'
    b'--' + boundary.encode() + b'--\r\n'
)

req = urllib.request.Request(
    'https://music-match-26112026.netlify.app/api/analyze',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, context=ctx) as r:
        print('STATUS:', r.status)
        print('RESPONSE:', r.read().decode())
except Exception as e:
    if hasattr(e, 'read'):
        print('HTTP ERROR:', e.code, e.read().decode()[:800])
    else:
        print('ERROR:', e)
