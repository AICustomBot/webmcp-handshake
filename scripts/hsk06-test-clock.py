from pathlib import Path
p=Path('tests/evidence.test.ts')
s=p.read_text()
marker="it('denies cross-session, mismatched, missing, consumed, and expired proof'"
i=s.index(marker)
head, tail=s[:i], s[i:]
old="""        acceptClaim,
      ),"""
new="""        acceptClaim,
        Date.parse('2026-09-02T12:01:00Z'),
      ),"""
if tail.count(old) < 3: raise SystemExit('expected three pre-expiry assertions')
tail=tail.replace(old,new,3)
p.write_text(head+tail)
