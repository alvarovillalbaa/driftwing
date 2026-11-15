"""Owned remote-only generated-game native qualification. No app install/build."""
from pathlib import Path
import hashlib,json,os,re,secrets,shutil,signal,stat,subprocess,time,urllib.request

repo=Path.cwd().resolve()
assert os.environ.get("CI")=="true" and os.environ.get("GITHUB_ACTIONS")=="true"
assert os.environ.get("GITHUB_REPOSITORY")=="alvarovillalbaa/driftwing"
assert os.environ.get("GITHUB_REF")=="refs/heads/qa/driftwing-generated-20261115"
assert re.fullmatch("[a-f0-9]{40}",os.environ["GITHUB_SHA"])
cases=os.environ["DRIFTWING_GENERATED_CASES"].split(",")
assert cases in (["L03"],["L01","L02","L04"])
short=cases==["L03"]
work_seconds=60 if short else 405
global_end=time.monotonic()+(165 if short else 525)
runner=Path(os.environ["RUNNER_TEMP"]).resolve()
job=os.environ["GITHUB_RUN_ID"]+"-"+os.environ["GITHUB_RUN_ATTEMPT"]
out=Path(os.environ["DRIFTWING_OUTPUT"]).resolve()
assert out.parent==runner and out.name=="driftwing-generated-proof-"+job and not out.exists()
out.mkdir(mode=0o700)
root=Path(__import__("tempfile").mkdtemp(prefix="dw-",dir="/tmp")).resolve()
root.chmod(0o700)
identity=root.lstat();nonce=secrets.token_hex(24)
(root/"owner").write_text(nonce);(root/"owner").chmod(0o600)
for name in ["tools","tmp","cache","config","browsers"]:
    (root/name).mkdir(mode=0o700)
for name in ["npm-user","npm-global"]:
    (root/name).write_text("");(root/name).chmod(0o600)
assert len(str(root/"tmp").encode())+64<108
env={k:os.environ[k] for k in ["PATH","HOME"] if k in os.environ}
env.update(LANG="C.UTF-8",TZ="UTC",CI="true",NO_COLOR="1",
    TMPDIR=str(root/"tmp"),TMP=str(root/"tmp"),TEMP=str(root/"tmp"),
    XDG_CACHE_HOME=str(root/"cache"),XDG_CONFIG_HOME=str(root/"config"),
    npm_config_userconfig=str(root/"npm-user"),npm_config_globalconfig=str(root/"npm-global"),
    npm_config_cache=str(root/"cache/npm"),npm_config_registry="https://registry.npmjs.org/",
    npm_config_audit="false",npm_config_fund="false",npm_config_update_notifier="false",
    PLAYWRIGHT_BROWSERS_PATH=str(root/"browsers"),PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1",
    DRIFTWING_CHECK_ROOT=str(root),DRIFTWING_PLAYWRIGHT_MODULE=str(root/"tools/node_modules/playwright/index.mjs"),
    DRIFTWING_OUTPUT=str(out),DRIFTWING_GENERATED_CASES=",".join(cases),
    DRIFTWING_WORK_SECONDS=str(work_seconds),SOURCE_COMMIT=os.environ["GITHUB_SHA"])
receipt={"schema":"driftwing.generated-native.v1","source":os.environ["GITHUB_SHA"],
    "run":os.environ["GITHUB_RUN_ID"],"attempt":os.environ["GITHUB_RUN_ATTEMPT"],"cases":cases,
    "passed":False,"commands":[],"priorCiSeconds":int(os.environ["DRIFTWING_PRIOR_CI_SECONDS"]),
    "capCiSeconds":1200,"limits":{"workSeconds":work_seconds,"cleanupSeconds":60,"jobMinutes":3 if short else 9},
    "appInstall":False,"appBuild":False,"database":False,"accounts":False,"forcedSignals":[],
    "sourceStable":False,"gitClean":False,"scratchRemoved":False}
assert receipt["priorCiSeconds"]+(180 if short else 540)<=1200
active=[];seen={};scan_uncertain=[];x11_before=None;server=None;before=None
def sha(b):return hashlib.sha256(b).hexdigest()
def write(name,value): (out/name).write_text(json.dumps(value,indent=2)+"\n")
def owner():
    s=root.lstat();m=root/"owner"
    assert root.parent==Path("/tmp") and s.st_uid==os.getuid() and not root.is_symlink()
    assert (s.st_dev,s.st_ino)==(identity.st_dev,identity.st_ino)
    assert m.is_file() and not m.is_symlink() and m.read_text()==nonce
def safe_read(file,limit=8*1024*1024):
    a=file.lstat();assert stat.S_ISREG(a.st_mode) and not file.is_symlink() and a.st_size<=limit
    b=file.read_bytes();z=file.lstat()
    assert (a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns,a.st_ctime_ns)==(z.st_dev,z.st_ino,z.st_size,z.st_mtime_ns,z.st_ctime_ns)
    assert len(b)==a.st_size
    return b
def vector():
    rows=[]
    for name in subprocess.check_output(["git","ls-files","-z"]).decode().split("\0"):
        if not name:continue
        b=safe_read(repo/name)
        rows.append({"path":name,"bytes":len(b),"sha256":sha(b)})
    return rows
def proc(pid):
    base=Path("/proc")/str(pid)
    if base.stat().st_uid!=os.getuid():return None
    text=(base/"stat").read_text();fields=text[text.rfind(")")+2:].split()
    argv=(base/"cmdline").read_bytes().decode(errors="replace").split("\0")
    again=(base/"stat").read_text();assert again[again.rfind(")")+2:].split()[19]==fields[19]
    key=str(pid)+":"+fields[19]
    owned=any(a==str(root) or a.startswith(str(root)+"/") or "="+str(root)+"/" in a for a in argv) or key in seen
    return {"pid":pid,"starttime":fields[19],"state":fields[0],"ppid":int(fields[1]),"pgid":int(fields[2]),
        "owned":owned,"executable":Path(argv[0]).name if argv and argv[0] else "",
        "display":next((int(a[1:]) for a in argv if re.fullmatch(r":\d+",a)),None)}
def scan():
    present=[]
    pids=[int(p.name) for p in Path("/proc").iterdir() if p.name.isdigit()]
    assert len(pids)<8192
    for pid in pids:
        if pid==os.getpid():continue
        try:
            p=proc(pid)
            if p and p["owned"]:
                key=str(pid)+":"+p["starttime"];seen.setdefault(key,p);present.append(p)
        except (FileNotFoundError,ProcessLookupError):pass
        except Exception as e:
            if len(scan_uncertain)<16:scan_uncertain.append(type(e).__name__)
    assert len(seen)<=256
    return present
def group_absent(pid):
    try:os.killpg(pid,0);return False
    except ProcessLookupError:return True
def force_group(child,reason):
    if not group_absent(child.pid):
        receipt["forcedSignals"].append({"pid":child.pid,"reason":reason,"signal":"SIGTERM"})
        os.killpg(child.pid,signal.SIGTERM)
        try:child.wait(timeout=3)
        except subprocess.TimeoutExpired:
            receipt["forcedSignals"].append({"pid":child.pid,"reason":reason,"signal":"SIGKILL"})
            os.killpg(child.pid,signal.SIGKILL);child.wait(timeout=3)
def start(label,args,cwd=repo):
    stem=str(len(receipt["commands"])+1).zfill(2)+"-"+label
    o=out/(stem+".stdout.txt");e=out/(stem+".stderr.txt")
    handles=[o.open("xb"),e.open("xb")]
    child=subprocess.Popen(args,cwd=cwd,env=env,stdout=handles[0],stderr=handles[1],start_new_session=True)
    row={"label":label,"argv":args,"pid":child.pid,"stdout":o.name,"stderr":e.name,
        "startMonotonic":time.monotonic(),"failure":None}
    item={"child":child,"row":row,"handles":handles,"paths":[o,e],"closed":False};active.append(item);receipt["commands"].append(row)
    return item
def finish(item,seconds=30,allow_failure=False):
    child=item["child"];row=item["row"]
    end=min(time.monotonic()+seconds,global_end-12)
    while child.poll() is None:
        scan()
        if time.monotonic()>end or sum(p.stat().st_size for p in item["paths"])>8*1024*1024:
            row["failure"]="deadline/output bound";force_group(child,row["failure"]);break
        time.sleep(.1)
    row["exit"]=child.wait()
    group_end=min(time.monotonic()+2,global_end-8)
    while not group_absent(child.pid) and time.monotonic()<group_end:time.sleep(.05)
    for f in item["handles"]:f.close()
    item["closed"]=True
    row["groupAbsent"]=group_absent(child.pid)
    if not row["groupAbsent"]:row["failure"]=row["failure"] or "remaining command group"
    row["seconds"]=round(time.monotonic()-row.pop("startMonotonic"),3)
    row["streamsComplete"]=row["failure"] is None and row["groupAbsent"]
    for name,p in zip(["stdout","stderr"],item["paths"]):row[name+"Sha256"]=sha(safe_read(p))
    if (row["exit"] or row["failure"]) and not allow_failure:raise RuntimeError(row["label"]+" failed")
    return safe_read(item["paths"][0]).decode()
def run(label,args,seconds=30,cwd=repo):
    return finish(start(label,args,cwd),seconds)
def bind(rows):
    for r in rows:
        b=safe_read(repo/r["path"]);assert len(b)==r["bytes"] and sha(b)==r["sha256"],r["path"]
def x11_inventory():
    entries=[]
    for p in list(Path("/tmp").glob(".X*-lock"))+list(Path("/tmp/.X11-unix").glob("X*")):
        s=p.lstat();entries.append({"path":str(p),"inode":s.st_ino,"dev":s.st_dev,"uid":s.st_uid})
    return sorted(entries,key=lambda r:r["path"])
def assets(label):
    observed=[]
    for row in manifest:
        url=env["DRIFTWING_CHECK_ORIGIN"]+"/"+row["path"]
        request=urllib.request.Request(url,headers={"Cache-Control":"no-cache"})
        with urllib.request.urlopen(request,timeout=5) as response:
            b=response.read(2*1024*1024+1);headers={k.lower():v for k,v in response.headers.items()}
            assert response.status==200 and response.url==url and len(b)==row["bytes"] and sha(b)==row["sha256"]
            for h in production["headers"][0]["headers"]:assert headers.get(h["key"].lower())==h["value"]
            observed.append({"url":url,"status":response.status,"bytes":len(b),"sha256":sha(b),"headers":headers})
    write("served-"+label+".json",observed);return observed

try:
    before=vector();write("source-before.json",before)
    receipt["node"]=run("node-version",["node","--version"]).strip();assert receipt["node"]=="v24.22.2"
    usage=shutil.disk_usage(root);receipt["storage"]={"freeBytes":usage.free,"requiredBytes":34*1024**3,"estimateBytes":4*1024**3}
    assert usage.free>=34*1024**3
    inputs=json.loads((repo/"docs/qualification/generated-v2-build-inputs.json").read_text())
    assert len(inputs)==11
    production_bytes=safe_read(repo/"docs/qualification/generated-v1-production-vercel.json")
    assert len(production_bytes)==691 and sha(production_bytes)=="a746a59e157185e859141597b39b4e0b2e2d258d9a837f7ec96117dc8a1998b8"
    assert hashlib.sha1(b"blob "+str(len(production_bytes)).encode()+b"\0"+production_bytes).hexdigest()=="8138ba426bea84cb719bf8129dba9b5ab01ed4ca"
    production=json.loads(production_bytes);qa=json.loads((repo/"vercel.json").read_text())
    assert qa.pop("git")=={"deploymentEnabled":False} and qa==production
    bind([r for r in inputs if r["path"]!="vercel.json"])
    assert next(r for r in inputs if r["path"]=="vercel.json")["sha256"]==sha(production_bytes)
    manifest=json.loads((repo/"docs/qualification/generated-v2-public.json").read_text())
    assert len(manifest)==8
    bind([dict(r,path="public/"+r["path"]) for r in manifest])
    n=repo/"docs/results/2026/11-15/generated-v1/node-1"
    node=json.loads((n/"node-runner.json").read_text())
    assert node["source"]=="d95340e4ab7f9388dd06520833885dbf4a7490c2" and node["passed"] and node["sourceStable"] and node["gitClean"] and node["node"]=="v24.22.2"
    assert node["nodeCases"]=={"tests":58,"pass":58,"fail":0,"skipped":0,"cancelled":0,"generatedCombinations":48}
    ni=json.loads((n/"node-inputs.json").read_text());assert len(ni)==9
    changed={"public/src/game.js","tests/game-audio.test.js"}
    bind([r for r in ni if r["path"] not in changed])
    original=json.loads((n/"source-before.json").read_text())
    assert original==json.loads((n/"source-after.json").read_text())
    bind([next(r for r in original if r["path"]==p) for p in
        ["scripts/check.mjs","package.json","vercel.json","public/index.html",
         "public/src/flight.js","public/src/records.js","public/src/renderer.js","public/src/audio.js"]])
    for c in node["commands"]:
        assert c["exit"]==0 and c["groupAbsent"] and c["streamsComplete"] and c["failure"] is None
        for key in ["stdout","stderr"]:assert sha(safe_read(n/c[key]))==c[key+"Sha256"]
    tap=safe_read(n/"03-node24-generated.stdout.txt")
    assert sha(tap)=="f7b849cb4cca6a99e82ba429722a9a800562ee96c5930b26072d5395104a7661"
    for key,value in [("tests",58),("pass",58),("fail",0),("skipped",0),("cancelled",0)]:
        assert re.search(rb"^# "+key.encode()+b" "+str(value).encode()+rb"$",tap,re.M)
    receipt["carriedNode"]={"run":43695792249,"source":node["source"],"originalCases":58,"carriedUnchangedCases":26,
        "supersededGameVmCases":32,"changedInputs":sorted(changed),"rawTapSha256":sha(tap),"exactOriginalInputs":ni,"rerun":False}
    focused_inputs=json.loads((repo/"docs/qualification/generated-v2-node-inputs.json").read_text())
    assert len(focused_inputs)==9;bind(focused_inputs);write("focused-node-inputs.json",focused_inputs)
    carry=os.environ.get("DRIFTWING_CARRY_FOCUSED")
    if carry:
        assert re.fullmatch(r"native-[3-9]",carry)
        previous=repo/"docs/results/2026/11-15/generated-v1"/carry
        qualified=json.loads((previous/"native-runner.json").read_text())
        assert qualified["sourceStable"] and qualified["gitClean"] and qualified["node"]=="v24.22.2" and qualified["focusedNode"]["passed"] and qualified["focusedNode"]["tests"]==35
        assert json.loads((previous/"focused-node-inputs.json").read_text())==focused_inputs
        prior_vector=json.loads((previous/"source-before.json").read_text())
        assert prior_vector==json.loads((previous/"source-after.json").read_text())
        bind([next(r for r in prior_vector if r["path"]==p) for p in ["scripts/check.mjs","vercel.json"]+[r["path"] for r in focused_inputs]])
        carried_commands=[c for c in qualified["commands"] if c["label"] in ["focused-source-check","focused-game-vm"]]
        assert len(carried_commands)==2 and {c["label"] for c in carried_commands}=={"focused-source-check","focused-game-vm"}
        for c in carried_commands:
            assert c["exit"]==0 and c["groupAbsent"] and c["streamsComplete"] and c["failure"] is None
            for key in ["stdout","stderr"]:assert sha(safe_read(previous/c[key]))==c[key+"Sha256"]
        receipt["focusedNode"]={**qualified["focusedNode"],"carriedFrom":carry,"carriedSource":qualified["source"],"rerun":False}
    else:
        run("focused-source-check",["node","scripts/check.mjs"],8)
        focused=run("focused-game-vm",["node","--test","--test-reporter=tap","tests/game-audio.test.js"],12)
        for key,value in [("tests",35),("pass",35),("fail",0),("skipped",0),("cancelled",0)]:
            assert re.search(r"^# "+key+r" "+str(value)+r"$",focused,re.M)
        receipt["focusedNode"]={"passed":True,"tests":35,"pass":35,"fail":0,"skipped":0,"cancelled":0,
            "newRegressionCases":3,"tapSha256":sha(focused.encode()),"rerun":True}
    write("identity.json",{"buildInputs":inputs,"public":manifest,"productionConfigGitBlob":"8138ba426bea84cb719bf8129dba9b5ab01ed4ca"})
    for name in ["Xvfb","xvfb-run","xauth","ldd"]:
        binary=Path(shutil.which(name) or "");assert binary.is_file(),name+" preinstalled"
        receipt.setdefault("preinstalled",[]).append({"name":name,"path":str(binary),"sha256":sha(binary.read_bytes())})
    run("fonts",["fc-list","--format","%{family}\n"],5)
    tools=root/"tools"
    for name in ["package.json","package-lock.json"]:shutil.copyfile(repo/"tests/fixtures/generated-tools"/name,tools/name)
    lock=safe_read(tools/"package-lock.json");(out/"tools-lock.json").write_bytes(lock)
    assert json.loads(lock)["packages"]["node_modules/playwright"]["version"]=="1.64.1"
    run("tool-install",["npm","ci","--ignore-scripts","--no-audit","--no-fund"],35,cwd=tools)
    assert safe_read(tools/"package-lock.json")==lock
    for name in ["playwright","playwright-core"]:
        assert json.loads((tools/"node_modules"/name/"package.json").read_text())["version"]=="1.64.1"
    run("browser-install",["node",str(tools/"node_modules/playwright/cli.js"),"install","--no-shell","chromium"],35,cwd=tools)
    exe=run("browser-path",["node","--input-type=module","-e","import {chromium} from "+json.dumps(env["DRIFTWING_PLAYWRIGHT_MODULE"])+";console.log(chromium.executablePath());"],5).strip()
    executable=Path(exe).resolve();assert executable.is_relative_to(root/"browsers") and executable.is_file()
    binary=safe_read(executable,536870912);assert binary[:4]==b"\x7fELF"
    receipt["browserExecutable"]={"path":str(executable),"bytes":len(binary),"sha256":sha(binary)}
    assert "not found" not in run("browser-libraries",["ldd",exe],10)
    ready=root/"ready.json";public_manifest=root/"manifest.json";public_manifest.write_text(json.dumps(manifest))
    env.update(DRIFTWING_READY=str(ready),DRIFTWING_MANIFEST=str(public_manifest))
    server=start("server",["node","tests/scripts/generated-server-v1.mjs"])
    ready_end=time.monotonic()+8
    while not ready.exists() and time.monotonic()<ready_end:
        assert server["child"].poll() is None;time.sleep(.05)
    r=json.loads(safe_read(ready,4096));assert r["pid"]==server["child"].pid and re.fullmatch(r"http://127\.0\.0\.1:\d+",r["url"])
    env["DRIFTWING_CHECK_ORIGIN"]=r["url"];receipt["origin"]=r["url"];receipt["serverReady"]=r
    first_assets=assets("before");x11_before=x11_inventory();write("x11-before.json",x11_before)
    xlog=root/"xvfb-errors.log";xlog.touch(mode=0o600);xlog_identity=xlog.lstat()
    auth=root/"xauthority"
    args=["xvfb-run","--auto-servernum","--error-file="+str(xlog),"--auth-file="+str(auth),
        "--server-args=-screen 0 1600x1200x24 -nolisten tcp","node","tests/browser/generated-v1.mjs"]
    native=start("browser",args)
    native_stdout=finish(native,130 if short else 475,allow_failure=True)
    assert xlog.lstat().st_ino==xlog_identity.st_ino
    (out/"xvfb-errors.txt").write_bytes(safe_read(xlog,1048576))
    report_file=out/"generated-browser.json"
    if report_file.exists():
        browser=json.loads(safe_read(report_file,393216));receipt["nativeSummary"]={"status":browser["status"],
            "cases":[{k:r.get(k) for k in ["id","accepted","durationMs","error"]} for r in browser["cases"]],
            "cleanup":browser["cleanup"],"profileClosures":browser["profileClosures"]}
    else:raise RuntimeError("Native report missing; streams retained")
    second_assets=assets("after")
    def stable_assets(rows):
        return [dict(r,headers={k:v for k,v in r["headers"].items() if k!="date"}) for r in rows]
    assert stable_assets(first_assets)==stable_assets(second_assets)
    assert native["row"]["exit"]==0 and native["row"]["streamsComplete"] and native["row"]["groupAbsent"]
    assert browser["status"]=="passed" and [c["id"] for c in browser["cases"]]==cases
    assert all(c["accepted"] and c["error"] is None for c in browser["cases"])
    assert len(browser["profileClosures"])==len(cases)
    assert browser["boundaries"]["events"]==[] and not browser["errors"]
    assert browser["cleanup"]["browserClosed"] and browser["cleanup"]["lateChecksComplete"] and browser["cleanup"]["fixtureCleanup"]=="passed"
    assert not browser["cleanup"]["failures"] and browser["cleanup"]["cdpSessionsRemaining"]==0
    receipt["passed"]=True
except Exception as error:
    receipt["error"]=type(error).__name__+": "+str(error)[:1500]
    frame=__import__("traceback").extract_tb(error.__traceback__)[-1]
    receipt["failureAt"]={"file":Path(frame.filename).name,"line":frame.lineno,"source":frame.line}
finally:
    try:
        if server and not server["closed"]:
            child=server["child"]
            receipt["serverStop"]={"signal":"SIGTERM","intendedGracefulClose":True}
            if child.poll() is None:os.killpg(child.pid,signal.SIGTERM)
            finish(server,7)
            assert server["row"]["exit"]==0 and server["row"]["groupAbsent"]
    except Exception as error:
        receipt["passed"]=False;receipt["serverCloseError"]=type(error).__name__+": "+str(error)[:300]
    for item in active:
        if item["closed"]:continue
        try:force_group(item["child"],"final incomplete command");finish(item,3,True)
        except Exception as error:receipt["passed"]=False;receipt.setdefault("cleanupErrors",[]).append(str(error)[:200])
    try:
        owner();present=scan();grace=time.monotonic()+2
        while present and time.monotonic()<grace:time.sleep(.1);present=scan()
        if present:
            receipt["passed"]=False
            for p in present:
                current=proc(p["pid"])
                if current and current["owned"] and current["starttime"]==p["starttime"]:
                    os.kill(p["pid"],signal.SIGTERM);receipt["forcedSignals"].append({"pid":p["pid"],"signal":"SIGTERM","reason":"owned residue"})
            time.sleep(.3);present=scan()
            for p in present:
                current=proc(p["pid"])
                if current and current["owned"] and current["starttime"]==p["starttime"]:
                    os.kill(p["pid"],signal.SIGKILL);receipt["forcedSignals"].append({"pid":p["pid"],"signal":"SIGKILL","reason":"owned residue"})
            time.sleep(.2);present=scan()
        receipt["processes"]={"seen":list(seen.values()),"present":present,"scanUncertain":scan_uncertain}
        assert not present and not scan_uncertain and not receipt["forcedSignals"]
        if x11_before is not None:
            observed=json.loads(safe_read(out/"xvfb-observed.json",4096))
            xp=next(p for p in seen.values() if p["pid"]==observed["pid"] and p["starttime"]==observed["starttime"] and p["executable"]=="Xvfb")
            assert xp["display"]==observed["display"]
            assert not any(r["path"] in [observed["lock"],observed["socket"]] for r in x11_before)
            assert not Path(observed["lock"]).exists() and not Path(observed["socket"]).exists()
            receipt["x11Cleanup"]={"observed":observed,"pidAbsent":not Path("/proc",str(observed["pid"])).exists(),"lockAbsent":True,"socketAbsent":True}
            assert receipt["x11Cleanup"]["pidAbsent"]
            write("x11-after.json",x11_inventory())
        owner();shutil.rmtree(root);receipt["scratchRemoved"]=not root.exists()
    except Exception as error:
        receipt["passed"]=False;receipt["cleanupError"]=type(error).__name__+": "+str(error)[:500]
    try:
        after=vector();write("source-after.json",after)
        receipt["sourceStable"]=before==after;receipt["gitClean"]=not subprocess.check_output(["git","status","--porcelain"]).strip()
    except Exception as error:receipt["sourceError"]=str(error)[:300];receipt["passed"]=False
    receipt["passed"]=bool(receipt["passed"] and receipt["sourceStable"] and receipt["gitClean"] and receipt["scratchRemoved"]
        and all(c.get("exit")==0 and c.get("groupAbsent") and c.get("streamsComplete") for c in receipt["commands"]))
    write("native-runner.json",receipt)
    print(json.dumps({k:v for k,v in receipt.items() if k not in ["commands","processes","carriedNode","preinstalled","nativeSummary"]}))
raise SystemExit(0 if receipt["passed"] else 1)
