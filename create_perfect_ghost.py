import numpy as np
import trimesh
from trimesh.visual import color

def create_ghost_mesh():
    # 1. Generate Body Mesh (Dome head + smooth body + wavy ruffled tail)
    n_theta = 64
    n_height = 40
    
    thetas = np.linspace(0, 2 * np.pi, n_theta, endpoint=False)
    
    # Height parameters: from bottom (-0.9) to top (1.0)
    # Bottom ruffled hem, middle torso, top dome
    verts = []
    
    # Generate grid of vertices
    for i in range(n_height):
        # t from 0 (bottom) to 1 (top of dome)
        t = i / (n_height - 1)
        
        if t < 0.25:
            # Bottom wavy ruffle section
            sub_t = t / 0.25
            y_base = -0.9 + sub_t * 0.4
            r_base = 1.05 - sub_t * 0.05
            # Ruffle amplitude decreases as we go up
            amp = (1.0 - sub_t) * 0.14
            for theta in thetas:
                # 6 ripples
                ripple = amp * np.sin(6 * theta)
                r = r_base + ripple
                y = y_base + (1.0 - sub_t) * 0.08 * np.cos(6 * theta)
                verts.append([r * np.sin(theta), y, r * np.cos(theta)])
        elif t < 0.65:
            # Middle torso
            sub_t = (t - 0.25) / 0.4
            y = -0.5 + sub_t * 0.75
            r = 1.0 - sub_t * 0.08
            for theta in thetas:
                verts.append([r * np.sin(theta), y, r * np.cos(theta)])
        else:
            # Rounded Dome Head
            sub_t = (t - 0.65) / 0.35 # 0 to 1
            # Sphere profile: y from 0.25 to 1.0, r from 0.92 to 0
            angle = sub_t * (np.pi / 2)
            y = 0.25 + 0.75 * np.sin(angle)
            r = 0.92 * np.cos(angle)
            for theta in thetas:
                verts.append([r * np.sin(theta), y, r * np.cos(theta)])
                
    # Add top tip vertex
    top_idx = len(verts)
    verts.append([0.0, 1.0, 0.0])
    
    # Add bottom center vertex to close bottom
    bot_idx = len(verts)
    verts.append([0.0, -0.85, 0.0])
    
    faces = []
    for i in range(n_height - 1):
        if i == n_height - 2:
            # Connect to top tip
            for j in range(n_theta):
                p1 = i * n_theta + j
                p2 = i * n_theta + (j + 1) % n_theta
                faces.append([p1, p2, top_idx])
        else:
            for j in range(n_theta):
                p1 = i * n_theta + j
                p2 = i * n_theta + (j + 1) % n_theta
                p3 = (i + 1) * n_theta + (j + 1) % n_theta
                p4 = (i + 1) * n_theta + j
                faces.append([p1, p2, p3])
                faces.append([p1, p3, p4])
                
    # Close bottom to make watertight
    for j in range(n_theta):
        p1 = j
        p2 = (j + 1) % n_theta
        faces.append([p2, p1, bot_idx])

    body_mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces))
    # Smooth normals
    body_mesh.fix_normals()
    # Ghost white color
    body_mesh.visual.vertex_colors = [250, 252, 255, 255]
    
    # 2. Arms
    # Waving Right Arm (raising up)
    r_arm = trimesh.creation.capsule(height=0.45, radius=0.17, count=[16, 16])
    # Rotate and position waving arm
    rot_arm_r = trimesh.transformations.rotation_matrix(np.radians(50), [0, 0, -1])
    rot_arm_r2 = trimesh.transformations.rotation_matrix(np.radians(20), [1, 0, 0])
    r_arm.apply_transform(rot_arm_r)
    r_arm.apply_transform(rot_arm_r2)
    r_arm.apply_translation([0.92, 0.15, 0.1])
    r_arm.visual.vertex_colors = [250, 252, 255, 255]
    
    # Left Arm (resting gently outward)
    l_arm = trimesh.creation.capsule(height=0.4, radius=0.17, count=[16, 16])
    rot_arm_l = trimesh.transformations.rotation_matrix(np.radians(-40), [0, 0, 1])
    l_arm.apply_transform(rot_arm_l)
    l_arm.apply_translation([-0.90, -0.05, 0.1])
    l_arm.visual.vertex_colors = [250, 252, 255, 255]

    # 3. Eyes (Big cute glossy black oval eyes)
    eye_l = trimesh.creation.icosphere(subdivisions=3, radius=0.12)
    eye_l.apply_scale([1.0, 1.35, 0.5])
    eye_l.apply_translation([-0.28, 0.32, 0.88])
    eye_l.visual.vertex_colors = [15, 17, 22, 255] # Black

    eye_r = trimesh.creation.icosphere(subdivisions=3, radius=0.12)
    eye_r.apply_scale([1.0, 1.35, 0.5])
    eye_r.apply_translation([0.28, 0.32, 0.88])
    eye_r.visual.vertex_colors = [15, 17, 22, 255] # Black

    # Eye Highlights (Cute white catchlights!)
    highlight_l = trimesh.creation.icosphere(subdivisions=2, radius=0.04)
    highlight_l.apply_translation([-0.25, 0.38, 0.93])
    highlight_l.visual.vertex_colors = [255, 255, 255, 255]

    highlight_r = trimesh.creation.icosphere(subdivisions=2, radius=0.04)
    highlight_r.apply_translation([0.31, 0.38, 0.93])
    highlight_r.visual.vertex_colors = [255, 255, 255, 255]

    # 4. Cheeks (Cute pink blushing cheeks)
    cheek_l = trimesh.creation.icosphere(subdivisions=2, radius=0.11)
    cheek_l.apply_scale([1.3, 0.75, 0.3])
    cheek_l.apply_translation([-0.46, 0.15, 0.82])
    cheek_l.visual.vertex_colors = [255, 140, 170, 255]

    cheek_r = trimesh.creation.icosphere(subdivisions=2, radius=0.11)
    cheek_r.apply_scale([1.3, 0.75, 0.3])
    cheek_r.apply_translation([0.46, 0.15, 0.82])
    cheek_r.visual.vertex_colors = [255, 140, 170, 255]

    # 5. Cute Smiling Open Mouth (:D)
    mouth = trimesh.creation.icosphere(subdivisions=3, radius=0.13)
    mouth.apply_scale([1.1, 1.0, 0.4])
    mouth.apply_translation([0.0, 0.16, 0.88])
    mouth.visual.vertex_colors = [25, 20, 25, 255] # Deep mouth

    tongue = trimesh.creation.icosphere(subdivisions=2, radius=0.08)
    tongue.apply_scale([1.1, 0.6, 0.4])
    tongue.apply_translation([0.0, 0.12, 0.90])
    tongue.visual.vertex_colors = [255, 110, 140, 255] # Pink tongue

    # Combine into Scene
    scene = trimesh.Scene([
        body_mesh, r_arm, l_arm,
        eye_l, eye_r, highlight_l, highlight_r,
        cheek_l, cheek_r,
        mouth, tongue
    ])
    
    return scene

if __name__ == "__main__":
    out_path = r"public/real_ghost.glb"
    scene = create_ghost_mesh()
    scene.export(out_path)
    print("SUCCESS: Created perfect 3D Ghost GLB at:", out_path)
