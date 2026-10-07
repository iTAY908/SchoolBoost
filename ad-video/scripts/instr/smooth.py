import json, cv2, numpy as np
D='/home/user/SchoolBoost/ad-video/public/source/instr/'
d=json.load(open(D+'tracking.json')); F=d['frames']; W,H=d['w'],d['h']; K=1080/W
n=len(F)
cx=np.array([f['face']['cx']*W for f in F]); fw=np.array([f['face']['w']*W for f in F])
tops=[]
for i,f in enumerate(F):
    a=cv2.imread(D+'person/%05d.png'%i,cv2.IMREAD_UNCHANGED)[:,:,3]
    c=int(cx[i]); hw=max(8,int(fw[i]*0.15))
    band=a[:,max(0,c-hw):min(W,c+hw)]
    rows=np.where((band>128).sum(1)>2)[0]
    tops.append(rows[0] if len(rows) else H*0.3)
tops=np.array(tops,float)
camx=np.array([f['cam']['x'] for f in F]); camy=np.array([f['cam']['y'] for f in F])
def sm(x,r):
    k=np.ones(2*r+1)/(2*r+1); p=np.pad(x,r,mode='edge'); return np.convolve(p,k,'valid')
out={'n':n,'cx':[round(v*K,1) for v in sm(cx,4)],'top':[round(v*K,1) for v in sm(tops,4)],
 'fw':[round(v*K,1) for v in sm(fw,6)],'camx':[round(v*K,1) for v in sm(camx,2)],'camy':[round(v*K,1) for v in sm(camy,2)]}
json.dump(out,open(D+'track-smooth.json','w'))
for i in [0,120,240,300,600,660,1040,1500]: print(i,out['cx'][i],out['top'][i],out['fw'][i],out['camx'][i],out['camy'][i])
