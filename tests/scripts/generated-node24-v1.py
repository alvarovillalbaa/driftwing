"""Bounded Node24 source qualification; no app install/build/browser/database."""
from pathlib import Path
import hashlib,json,os,re,signal,subprocess,time
repo=Path.cwd().resolve();runner=Path(os.environ["RUNNER_TEMP"]).resolve()
job=os.environ["GITHUB_RUN_ID"]+"-"+os.environ["GITHUB_RUN_ATTEMPT"]
out=Path(os.environ["DRIFTWING_OUTPUT"]).resolve()
assert out.parent==runner and out.name=="driftwing-generated-proof-"+job and not out.exists()
out.mkdir()
receipt={"source":os.environ["GITHUB_SHA"],"nodeCases":None,"passed":False,"appInstall":False,"appBuild":False,"browser":False,"database":False,"priorCiSeconds":539,"commands":[]}
def sha(b):return hashlib.sha256(b).hexdigest()
def vector():
    rows=[]
    for p in subprocess.check_output(["git","ls-files","-z"]).decode().split("\0"):
        if not p:continue
        f=repo/p;assert f.is_file() and not f.is_symlink()
        rows.append({"path":p,"bytes":f.stat().st_size,"sha256":sha(f.read_bytes())})
    return rows
before=vector();(out/"source-before.json").write_text(json.dumps(before,indent=2)+"\n")
def run(label,args,seconds=30):
    stem=str(len(receipt["commands"])+1).zfill(2)+"-"+label
    output=out/(stem+".stdout.txt");error=out/(stem+".stderr.txt")
    row={"label":label,"argv":args,"stdout":output.name,"stderr":error.name};receipt["commands"].append(row)
    start=time.monotonic();failure=None
    with output.open("xb") as stdout,error.open("xb") as stderr:
        child=subprocess.Popen(args,cwd=repo,stdout=stdout,stderr=stderr,start_new_session=True)
        while child.poll() is None:
            if time.monotonic()-start>seconds or output.stat().st_size+error.stat().st_size>4*1024*1024:
                failure="deadline/output limit";os.killpg(child.pid,signal.SIGTERM)
                try:child.wait(timeout=3)
                except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait(timeout=3)
                break
            time.sleep(.05)
        row["exit"]=child.wait()
        try:
            os.killpg(child.pid,0);row["groupAbsent"]=False;os.killpg(child.pid,signal.SIGTERM);failure=failure or "remaining owned process group"
        except ProcessLookupError:row["groupAbsent"]=True
    row.update(seconds=round(time.monotonic()-start,3),failure=failure,streamsComplete=failure is None,stdoutSha256=sha(output.read_bytes()),stderrSha256=sha(error.read_bytes()))
    if row["exit"] or failure:raise RuntimeError(label+" failed; original streams retained")
    return output.read_text()
try:
    receipt["node"]=run("node-version",["node","--version"]).strip();assert receipt["node"]=="v24.22.2"
    inputs=json.loads((repo/"docs/qualification/generated-v1-node-inputs.json").read_text());assert len(inputs)==9
    for item in inputs:
        b=(repo/item["path"]).read_bytes();assert len(b)==item["bytes"] and sha(b)==item["sha256"],item["path"]
    (out/"node-inputs.json").write_text(json.dumps(inputs,indent=2)+"\n")
    run("source-check",["node","scripts/check.mjs"])
    tap=run("node24-generated",["node","--test","--test-reporter=tap","tests/flight.test.js","tests/records.test.js","tests/game-audio.test.js","tests/unit/generated-levels.test.js"])
    for key,value in (("tests",58),("pass",58),("fail",0),("skipped",0),("cancelled",0)):
        assert re.search(r"^# "+key+r" "+str(value)+r"$",tap,re.M),("Unexpected explicit TAP",key)
    receipt["nodeCases"]={"tests":58,"pass":58,"fail":0,"skipped":0,"cancelled":0,"generatedCombinations":48}
    receipt["passed"]=True
except Exception as error:receipt["error"]=type(error).__name__+": "+str(error)
finally:
    after=vector();(out/"source-after.json").write_text(json.dumps(after,indent=2)+"\n")
    receipt["sourceStable"]=before==after;receipt["gitClean"]=not subprocess.check_output(["git","status","--porcelain"]).strip()
    receipt["passed"]=bool(receipt["passed"] and receipt["sourceStable"] and receipt["gitClean"] and all(c.get("groupAbsent") for c in receipt["commands"]))
    (out/"node-runner.json").write_text(json.dumps(receipt,indent=2)+"\n");print(json.dumps({k:v for k,v in receipt.items() if k!="commands"}))
raise SystemExit(0 if receipt["passed"] else 1)

