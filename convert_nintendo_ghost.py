import pyassimp
import trimesh
import os

fbx_path = r"C:\Users\chltj\Desktop\ai\vacant-house-ar\t1fnmgvxx9-NinTEndoGhost\Nintendoghost.FBX"
out_glb_path = r"C:\Users\chltj\Desktop\ai\vacant-house-ar\public\nintendo_ghost.glb"

try:
    print("Loading FBX via pyassimp...")
    scene = pyassimp.load(fbx_path)
    print("Exporting to GLB...")
    pyassimp.export(scene, out_glb_path, 'glb2')
    pyassimp.release(scene)
    print("SUCCESS: Exported Nintendo Ghost GLB to", out_glb_path)
except Exception as e:
    print("Pyassimp failed:", e)
    # Fallback to direct Python FBX parser
