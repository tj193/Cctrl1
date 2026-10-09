from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent
files=['README.md','STORYBOARD.md','package.json','package-lock.json','tsconfig.json','remotion.config.ts','capture.cjs','server.cjs','local-api.py','requirements-demo.txt','prepare-frames.cjs','verify.cjs','produce.ps1','public/capture.webm','public/capture-meta.json','public/timeline.json','public/logo.png']
files += [str(p.relative_to(root)) for p in (root/'src').rglob('*') if p.is_file()]
(root/'out').mkdir(exist_ok=True)
with ZipFile(root/'out/DarbGo-editable.zip','w',ZIP_DEFLATED) as z:
    for name in files: z.write(root/name,'demo-video/'+name.replace('\\','/'))
print('Editable project packaged:',len(files),'files')
