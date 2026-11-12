import re, sys, json

html = open(".tmp-val.html", encoding="utf-8", errors="ignore").read()
# payload serializado do RSC tem \"...\"  -> normaliza escapes basicos
dec = html.replace('\\"', '"').replace("\\u0026", "&")
# blocos por playerId
blocks = re.findall(r'\{[^{}]*"playerId"[^{}]*?"factors":\{[^{}]*\}[^{}]*\}', dec)
print("blocos:", len(blocks))


def g(b, pat):
    m = re.search(pat, b)
    return m.group(1) if m else "?"


rows = []
for b in blocks:
    rows.append({
        "name": g(b, r'"name":"([^"]+)"'),
        "club": g(b, r'"club":"([^"]+)"'),
        "age": g(b, r'"age":(\d+|null)'),
        "rating": g(b, r'"rating":([\d.]+)'),
        "minutes": g(b, r'"minutes":(\d+)'),
        "tm": g(b, r'"marketValueEur":(\d+|null)'),
        "sada": g(b, r'"sadaValue":([\d.]+)'),
        "cY": g(b, r'"contractYears":([\d.]+|null)'),
        "caps": g(b, r'"caps":(\d+|null)'),
        "rs": g(b, r'"resaleScore":(\d+|null)'),
        "f": b[b.find('"factors"'):b.find('"factors"') + 300],
    })

rows.sort(key=lambda r: -float(r["sada"] if r["sada"] != "?" else 0))
alvo = sys.argv[1] if len(sys.argv) > 1 else ""
for r in rows:
    if alvo and alvo.lower() not in (r["name"] + r["club"]).lower():
        continue
    print("%-24s %-18s SADA=%5.1fM TM=%-9s age=%-4s rat=%-4s min=%-5s ctr=%-4s caps=%-3s rev=%s"
          % (r["name"], r["club"], float(r["sada"]) / 1e6 if r["sada"] != "?" else 0,
             r["tm"], r["age"], r["rating"], r["minutes"], r["cY"], r["caps"], r["rs"]))
    print("    " + r["f"])
