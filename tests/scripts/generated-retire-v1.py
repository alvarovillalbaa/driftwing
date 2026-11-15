"""INACTIVE: leased deletion of the single owned QA branch after accepted release."""
from pathlib import Path
import hashlib,json,os,re,urllib.error,urllib.request
assert os.environ.get("CI")=="true" and os.environ.get("GITHUB_ACTIONS")=="true"
assert os.environ.get("GITHUB_REPOSITORY")=="alvarovillalbaa/driftwing"
assert os.environ.get("GITHUB_REF")=="refs/heads/qa/driftwing-generated-20261115"
assert os.environ.get("DRIFTWING_APPROVAL")=="driftwing-native-v5-10m"
assert int(os.environ["DRIFTWING_PRIOR_CI_SECONDS"])+60<=1800
expected=os.environ["DRIFTWING_EXPECTED_MAIN"];head=os.environ["GITHUB_SHA"]
assert re.fullmatch("[a-f0-9]{40}",expected) and re.fullmatch("[a-f0-9]{40}",head)
repo=Path.cwd().resolve();runner=Path(os.environ["RUNNER_TEMP"]).resolve();out=Path(os.environ["DRIFTWING_OUTPUT"]).resolve()
assert out.parent==runner and not out.exists();out.mkdir(mode=0o700)
base="https://api.github.com/repos/alvarovillalbaa/driftwing"
token=os.environ["GH_TOKEN"];assert token
receipt={"schema":"driftwing.generated-retirement.v1","qaSource":head,"expectedMain":expected,
 "priorCiSeconds":int(os.environ["DRIFTWING_PRIOR_CI_SECONDS"]),"capCiSeconds":1800,"passed":False,"deleted":False}
def api(path,method="GET",allow404=False,archive=None):
 assert path.startswith("/git/") and method in ["GET","DELETE"]
 req=urllib.request.Request(base+path,method=method,headers={"Authorization":"Bearer "+token,
  "Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"Driftwing-owned-retirement/1"})
 try:
  with urllib.request.urlopen(req,timeout=7) as response:code=response.status;raw=response.read(2097153)
 except urllib.error.HTTPError as error:
  if not allow404 or error.code!=404:raise RuntimeError("GitHub "+method+" status "+str(error.code))
  code=404;raw=error.read(65537)
 assert len(raw)<=2097152
 if archive:(out/archive).write_bytes(raw)
 return code,json.loads(raw) if raw else None
try:
 main_status,main=api("/git/ref/heads/main",archive="main-ref.json")
 qa_status,qa=api("/git/ref/heads/qa/driftwing-generated-20261115",archive="qa-ref.json")
 assert main_status==qa_status==200 and main["object"]["sha"]==expected and qa["object"]["sha"]==head
 _,mc=api("/git/commits/"+expected);_,qc=api("/git/commits/"+head)
 _,mt=api("/git/trees/"+mc["tree"]["sha"]+"?recursive=1",archive="main-tree.json")
 _,qt=api("/git/trees/"+qc["tree"]["sha"]+"?recursive=1",archive="qa-tree.json")
 assert not mt["truncated"] and not qt["truncated"]
 assert not any(r["path"].startswith(".github/workflows/") for r in mt["tree"])
 expected_blobs=json.loads((repo/"docs/qualification/generated-v4-release-blobs.json").read_text());assert len(expected_blobs)==11
 for row in expected_blobs:
  entry=next(r for r in mt["tree"] if r["path"]==row["path"])
  assert entry["type"]=="blob" and entry["sha"]==row["gitBlob"] and entry["size"]==row["bytes"]
 assert next(r for r in qt["tree"] if r["path"]=="vercel.json")["sha"]=="69d69d88fad09d0c627d79ef74e3ba9806fbc467"
 # Read the lease again immediately before deleting the unique task-owned ref.
 _,latest=api("/git/ref/heads/qa/driftwing-generated-20261115")
 assert latest["object"]["sha"]==head
 code,_=api("/git/refs/heads/qa/driftwing-generated-20261115",method="DELETE")
 assert code==204;receipt["deleted"]=True;receipt["deleteStatus"]=code
 code,_=api("/git/ref/heads/qa/driftwing-generated-20261115",allow404=True)
 assert code==404;receipt["readbackStatus"]=code
 _,final_main=api("/git/ref/heads/main");assert final_main["object"]["sha"]==expected
 receipt.update(passed=True,mainUnchanged=True,expectedBuildBlobs=expected_blobs,activeMainWorkflow=False)
except Exception as error:receipt["error"]=type(error).__name__+": "+str(error)[:700]
finally:
 token=None
 (out/"retirement.json").write_text(json.dumps(receipt,indent=2)+"\n")
 print(json.dumps({k:v for k,v in receipt.items() if k!="expectedBuildBlobs"}))
raise SystemExit(0 if receipt["passed"] else 1)
