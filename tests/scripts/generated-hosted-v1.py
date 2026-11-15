"""One-minute anonymous hosted readback, after exact release and READY metadata."""
from pathlib import Path
import hashlib,json,os,re,secrets,shutil,signal,stat,subprocess,tempfile,time,urllib.request
repo=Path.cwd().resolve();runner=Path(os.environ["RUNNER_TEMP"]).resolve()
assert os.environ.get("CI")=="true" and os.environ.get("GITHUB_ACTIONS")=="true"
assert os.environ.get("GITHUB_REPOSITORY")=="alvarovillalbaa/driftwing"
assert os.environ.get("GITHUB_REF")=="refs/heads/qa/driftwing-generated-20261115"
assert os.environ.get("DRIFTWING_APPROVAL")=="driftwing-native-v5-10m"
prior=int(os.environ["DRIFTWING_PRIOR_CI_SECONDS"]);assert prior+60<=1800
release=os.environ["DRIFTWING_RELEASE_SOURCE"];deployment=os.environ["DRIFTWING_DEPLOYMENT"]
assert re.fullmatch("[a-f0-9]{40}",release) and re.fullmatch("dpl_[A-Za-z0-9]+",deployment)
out=Path(os.environ["DRIFTWING_OUTPUT"]).resolve();assert out.parent==runner and not out.exists()
out.mkdir(mode=0o700);root=Path(tempfile.mkdtemp(prefix="dw-",dir="/tmp")).resolve();root.chmod(0o700)
identity=root.lstat();nonce=secrets.token_hex(24);(root/"owner").write_text(nonce)
for p in ["tools","browsers","tmp","cache","config"]:(root/p).mkdir(mode=0o700)
for p in ["npm-user","npm-global"]:(root/p).write_text("")
env={k:os.environ[k] for k in ["PATH","HOME"] if k in os.environ}
env.update(CI="true",LANG="C.UTF-8",TZ="UTC",NO_COLOR="1",TMPDIR=str(root/"tmp"),TMP=str(root/"tmp"),TEMP=str(root/"tmp"),
 npm_config_userconfig=str(root/"npm-user"),npm_config_globalconfig=str(root/"npm-global"),npm_config_cache=str(root/"cache/npm"),
 npm_config_audit="false",npm_config_fund="false",npm_config_update_notifier="false",npm_config_registry="https://registry.npmjs.org/",
 PLAYWRIGHT_BROWSERS_PATH=str(root/"browsers"),PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1",XDG_CACHE_HOME=str(root/"cache"),XDG_CONFIG_HOME=str(root/"config"),
 DRIFTWING_OUTPUT=str(out),DRIFTWING_PLAYWRIGHT_MODULE=str(root/"tools/node_modules/playwright/index.mjs"),
 DRIFTWING_HOSTED_ORIGIN="https://driftwing-alvaro.vercel.app",DRIFTWING_RELEASE_SOURCE=release,DRIFTWING_DEPLOYMENT=deployment,SOURCE_COMMIT=os.environ["GITHUB_SHA"])
end=time.monotonic()+48;receipt={"schema":"driftwing.generated-hosted.v1","qaSource":os.environ["GITHUB_SHA"],"releaseSource":release,
 "deployment":deployment,"priorCiSeconds":prior,"capCiSeconds":1800,"passed":False,"commands":[],"forcedSignals":[],
 "appBuild":False,"appInstall":False,"accounts":False,"database":False,"sourceStable":False,"gitClean":False,"scratchRemoved":False}
active=[];before=None;seen={};uncertain=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def write(name,v):(out/name).write_text(json.dumps(v,indent=2)+"\n")
def read(p,limit=8*1024*1024):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and not p.is_symlink() and s.st_size<=limit
 b=p.read_bytes();assert len(b)==s.st_size and p.lstat().st_mtime_ns==s.st_mtime_ns;return b
def vector():
 return [{"path":p,"bytes":len(read(repo/p)),"sha256":sha(read(repo/p))} for p in subprocess.check_output(["git","ls-files","-z"]).decode().split("\0") if p]
def proc(pid):
 p=Path("/proc")/str(pid)
 if p.stat().st_uid!=os.getuid():return None
 t=(p/"stat").read_text();s=t[t.rfind(")")+2:].split();args=(p/"cmdline").read_bytes().decode(errors="replace").split("\0")
 owned=any(str(root)+"/" in a for a in args) or str(pid)+":"+s[19] in seen
 return {"pid":pid,"starttime":s[19],"executable":Path(args[0]).name if args[0] else "","owned":owned,"state":s[0]}
def scan():
 current=[]
 for name in Path("/proc").iterdir():
  if not name.name.isdigit() or int(name.name)==os.getpid():continue
  try:
   p=proc(int(name.name))
   if p and p["owned"]:seen.setdefault(str(p["pid"])+":"+p["starttime"],p);current.append(p)
  except (FileNotFoundError,ProcessLookupError):pass
  except Exception as e:uncertain.append(type(e).__name__)
 assert len(seen)<256 and len(uncertain)<16
 return current
def absent(pid):
 try:os.killpg(pid,0);return False
 except ProcessLookupError:return True
def run(label,args,seconds=10,cwd=repo):
 stem=str(len(receipt["commands"])+1).zfill(2)+"-"+label;o=out/(stem+".stdout.txt");e=out/(stem+".stderr.txt")
 row={"label":label,"argv":args,"stdout":o.name,"stderr":e.name,"failure":None};receipt["commands"].append(row);start=time.monotonic()
 with o.open("xb") as stdout,e.open("xb") as stderr:
  child=subprocess.Popen(args,cwd=cwd,env=env,stdout=stdout,stderr=stderr,start_new_session=True);active.append(child)
  limit=min(time.monotonic()+seconds,end)
  while child.poll() is None:
   scan()
   if time.monotonic()>limit or o.stat().st_size+e.stat().st_size>4*1024*1024:
    row["failure"]="deadline/output bound";receipt["forcedSignals"].append({"pid":child.pid,"signal":"SIGTERM"})
    os.killpg(child.pid,signal.SIGTERM)
    try:child.wait(timeout=2)
    except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);receipt["forcedSignals"].append({"pid":child.pid,"signal":"SIGKILL"});child.wait(timeout=2)
    break
   time.sleep(.05)
  row["exit"]=child.wait();grace=time.monotonic()+1
  while not absent(child.pid) and time.monotonic()<grace:time.sleep(.05)
 row.update(groupAbsent=absent(child.pid),seconds=round(time.monotonic()-start,3),streamsComplete=row["failure"] is None and absent(child.pid))
 for k,p in [("stdout",o),("stderr",e)]:row[k+"Sha256"]=sha(read(p))
 assert row["exit"]==0 and row["streamsComplete"],label
 return read(o).decode()
def assets(label):
 rows=[]
 targets=[dict(r,url=env["DRIFTWING_HOSTED_ORIGIN"]+("/" if r["path"]=="index.html" else "/"+r["path"])) for r in manifest]
 for r in targets:
  assert time.monotonic()<end
  req=urllib.request.Request(r["url"],headers={"Cache-Control":"no-cache","User-Agent":"Driftwing-owned-H01/1"})
  with urllib.request.urlopen(req,timeout=4) as response:
   b=response.read(2097153);headers={k.lower():v for k,v in response.headers.items()}
   assert response.status==200 and response.url==r["url"] and len(b)==r["bytes"] and sha(b)==r["sha256"]
   for h in production["headers"][0]["headers"]:assert headers.get(h["key"].lower())==h["value"]
   rows.append({"url":response.url,"status":response.status,"bytes":len(b),"sha256":sha(b),"headers":headers})
 write("hosted-"+label+".json",rows);return rows
try:
 before=vector();write("source-before.json",before)
 receipt["node"]=run("node-version",["node","--version"],3).strip();assert receipt["node"]=="v24.22.2"
 usage=shutil.disk_usage(root);receipt["freeBytes"]=usage.free;assert usage.free>=34*1024**3
 production=json.loads(read(repo/"docs/qualification/generated-v1-production-vercel.json"));qa=json.loads(read(repo/"vercel.json"))
 assert qa.pop("git")=={"deploymentEnabled":False} and qa==production
 inputs=json.loads(read(repo/"docs/qualification/generated-v4-build-inputs.json"));manifest=json.loads(read(repo/"docs/qualification/generated-v4-public.json"))
 assert len(inputs)==11 and len(manifest)==8
 for r in inputs:
  b=read(repo/("docs/qualification/generated-v1-production-vercel.json" if r["path"]=="vercel.json" else r["path"]))
  assert len(b)==r["bytes"] and sha(b)==r["sha256"]
 write("hosted-inputs.json",{"build":inputs,"public":manifest,"releaseSource":release,"deployment":deployment})
 first=assets("before");tools=root/"tools"
 for p in ["package.json","package-lock.json"]:shutil.copyfile(repo/"tests/fixtures/generated-tools"/p,tools/p)
 lock=read(tools/"package-lock.json");(out/"tools-lock.json").write_bytes(lock)
 run("tool-install",["npm","ci","--ignore-scripts","--no-audit","--no-fund"],10,tools)
 assert read(tools/"package-lock.json")==lock
 for p in ["playwright","playwright-core"]:assert json.loads(read(tools/"node_modules"/p/"package.json"))["version"]=="1.64.1"
 run("browser-install",["node",str(tools/"node_modules/playwright/cli.js"),"install","--no-shell","chromium"],12,tools)
 run("public-browser",["node","tests/browser/generated-hosted-v1.mjs"],34)
 browser=json.loads(read(out/"hosted-browser.json"));assert browser["passed"]
 second=assets("after")
 assert [(r["url"],r["bytes"],r["sha256"]) for r in first]==[(r["url"],r["bytes"],r["sha256"]) for r in second]
 receipt["browser"]=browser;receipt["passed"]=True
except Exception as error:
 receipt["error"]=type(error).__name__+": "+str(error)[:1000]
 frame=__import__("traceback").extract_tb(error.__traceback__)[-1];receipt["failureAt"]={"file":Path(frame.filename).name,"line":frame.lineno,"source":frame.line}
finally:
 try:
  s=root.lstat();assert s.st_uid==os.getuid() and (s.st_dev,s.st_ino)==(identity.st_dev,identity.st_ino) and (root/"owner").read_text()==nonce and not root.is_symlink()
  current=scan();grace=time.monotonic()+1
  while current and time.monotonic()<grace:time.sleep(.05);current=scan()
  receipt["processes"]={"seen":list(seen.values()),"present":current,"uncertain":uncertain}
  if current:
   receipt["passed"]=False
   for p in current:
    now=proc(p["pid"])
    if now and now["owned"] and now["starttime"]==p["starttime"]:
     os.kill(p["pid"],signal.SIGTERM);receipt["forcedSignals"].append({"pid":p["pid"],"signal":"SIGTERM"})
   time.sleep(.2);current=scan()
  assert not current and not uncertain and not receipt["forcedSignals"] and all(absent(c.pid) for c in active)
  shutil.rmtree(root);receipt["scratchRemoved"]=not root.exists()
 except Exception as error:receipt["passed"]=False;receipt["cleanupError"]=type(error).__name__+": "+str(error)[:500]
 try:
  after=vector();write("source-after.json",after);receipt["sourceStable"]=before==after
  receipt["gitClean"]=not subprocess.check_output(["git","status","--porcelain"]).strip()
 except Exception as error:receipt["passed"]=False;receipt["sourceError"]=str(error)[:500]
 receipt["passed"]=bool(receipt["passed"] and receipt["sourceStable"] and receipt["gitClean"] and receipt["scratchRemoved"])
 write("hosted-runner.json",receipt);print(json.dumps({k:v for k,v in receipt.items() if k not in ["commands","processes","browser"]}))
raise SystemExit(0 if receipt["passed"] else 1)
