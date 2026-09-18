import struct
import zlib
import numpy as np
import trimesh

def parse_fbx_binary(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()

    offset = 27
    version = struct.unpack('<I', data[23:27])[0]

    vertices = []
    indices = []

    def read_node(off):
        if off >= len(data) - 16:
            return None, off
        end_offset = struct.unpack('<I', data[off:off+4])[0]
        if end_offset == 0:
            return None, off + 13
        num_props = struct.unpack('<I', data[off+4:off+8])[0]
        prop_list_len = struct.unpack('<I', data[off+8:off+12])[0]
        name_len = data[off+12]
        name = data[off+13:off+13+name_len].decode('ascii', errors='ignore')
        
        curr = off + 13 + name_len
        props = []
        for _ in range(num_props):
            p_type = chr(data[curr])
            curr += 1
            if p_type in ('Y', 'C', 'I', 'F', 'D', 'L'):
                sz_map = {'Y': 2, 'C': 1, 'I': 4, 'F': 4, 'D': 8, 'L': 8}
                fmt_map = {'Y': '<h', 'C': '?', 'I': '<i', 'F': '<f', 'D': '<d', 'L': '<q'}
                sz = sz_map[p_type]
                val = struct.unpack(fmt_map[p_type], data[curr:curr+sz])[0]
                curr += sz
                props.append(val)
            elif p_type in ('f', 'd', 'i', 'l', 'b', 'c'):
                array_len, encoding, comp_len = struct.unpack('<III', data[curr:curr+12])
                curr += 12
                raw_data = data[curr:curr+comp_len]
                curr += comp_len
                if encoding == 1:
                    raw_data = zlib.decompress(raw_data)
                
                sz_map = {'f': 4, 'd': 8, 'i': 4, 'l': 8, 'b': 1, 'c': 1}
                elem_sz = sz_map[p_type]
                num_elems = len(raw_data) // elem_sz
                arr = struct.unpack(f'<{num_elems}{p_type[0]}', raw_data)
                props.append(arr)
            elif p_type in ('S', 'R'):
                s_len = struct.unpack('<I', data[curr:curr+4])[0]
                curr += 4
                val = data[curr:curr+s_len]
                curr += s_len
                props.append(val)

        if name == 'Vertices':
            nonlocal vertices
            for p in props:
                if isinstance(p, (list, tuple)):
                    vertices.extend(p)
                else:
                    vertices.append(p)
        elif name == 'PolygonVertexIndex':
            nonlocal indices
            for p in props:
                if isinstance(p, (list, tuple)):
                    indices.extend(p)
                else:
                    indices.append(p)

        while curr < end_offset:
            child, curr = read_node(curr)

        return (name, props), end_offset

    while offset < len(data) - 16:
        node, offset = read_node(offset)
        if node is None:
            break

    print(f"Extracted {len(vertices)//3} vertices and {len(indices)} polygon indices")
    return vertices, indices

fbx_file = r"C:\Users\chltj\Desktop\ai\vacant-house-ar\t1fnmgvxx9-NinTEndoGhost\Nintendoghost.FBX"
out_glb = r"C:\Users\chltj\Desktop\ai\vacant-house-ar\public\nintendo_boo.glb"

verts, idxs = parse_fbx_binary(fbx_file)

if len(verts) > 0 and len(idxs) > 0:
    v_arr = np.array(verts, dtype=np.float32).reshape(-1, 3)
    
    faces = []
    poly = []
    for idx in idxs:
        if idx < 0:
            poly.append(~idx)
            for i in range(1, len(poly) - 1):
                faces.append([poly[0], poly[i], poly[i+1]])
            poly = []
        else:
            poly.append(idx)
            
    f_arr = np.array(faces, dtype=np.int32)
    print(f"Constructed mesh with {len(v_arr)} vertices and {len(f_arr)} triangles")

    # Center and normalize mesh size
    v_arr = v_arr - np.mean(v_arr, axis=0)
    max_dim = np.max(np.abs(v_arr))
    if max_dim > 0:
        v_arr = v_arr / max_dim

    # Export using trimesh
    mesh = trimesh.Trimesh(vertices=v_arr, faces=f_arr)
    mesh.export(out_glb)
    print("SUCCESSFULLY EXPORTED NINTENDO BOO GHOST TO:", out_glb)
