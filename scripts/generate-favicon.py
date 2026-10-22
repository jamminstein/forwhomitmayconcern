"""Render the site's cubic-Bezier shuffle doodles as a looping GIF and tab frames."""
from pathlib import Path
from PIL import Image, ImageDraw
import random
root=Path(__file__).resolve().parents[1]
rng=random.Random(1276)
frames=[]
for index in range(16):
    image=Image.new('RGB',(160,160),'white')
    draw=ImageDraw.Draw(image)
    point=(rng.uniform(8,15),rng.uniform(8,14))
    coords=[point]
    for _ in range(4):
        a,b,end=[(rng.uniform(3,37),rng.uniform(3,37)) for _ in range(2)]+[(rng.uniform(6,34),rng.uniform(6,34))]
        for step in range(1,65):
            t=step/64;q=1-t
            coords.append(tuple(q**3*point[k]+3*q*q*t*a[k]+3*q*t*t*b[k]+t**3*end[k] for k in range(2)))
        point=end
    coords.append((rng.uniform(9,32),rng.uniform(8,33)))
    draw.line([(x*4,y*4) for x,y in coords],fill='black',width=6,joint='curve')
    image=image.resize((32,32),Image.Resampling.LANCZOS)
    image.save(root/'favicon-frames'/f'{index:02d}.png')
    frames.append(image)
frames[0].save(root/'favicon.gif',save_all=True,append_images=frames[1:],duration=650,loop=0,disposal=2)
frames[0].save(root/'favicon.ico',sizes=[(16,16),(32,32)])
with Image.open(root/'favicon.gif') as result:
    assert result.n_frames==16 and result.info['loop']==0
print('Created a looping 16-frame GIF, PNG animation frames, and static ICO fallback.')
