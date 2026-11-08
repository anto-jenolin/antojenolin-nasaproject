import os
from dulwich import porcelain as p
from dulwich.repo import Repo

repo_path = "d:/nasa project"
repo = Repo(repo_path)

# Stage all files according to .gitignore
print("Staging files...")
# Add all files in workspace
files_to_add = []
for root, dirs, files in os.walk(repo_path):
    if ".git" in root or "node_modules" in root or "__pycache__" in root or "MOD13C2_Parquet" in root:
        continue
    for f in files:
        if f.endswith(".parquet") or f.endswith(".pkl") or f.endswith(".db"):
            continue
        rel_path = os.path.relpath(os.path.join(root, f), repo_path).replace("\\", "/")
        files_to_add.append(rel_path)

print(f"Adding {len(files_to_add)} files...")
p.add(repo, files_to_add)

# Commit
commit_id = p.commit(repo, message=b"Initial production release: TerraPulse AI - NASA Earth Change Explorer & ML Studio", author=b"Anto Jenolin <antojenolin3126@gmail.com>")
print("Committed successfully:", commit_id.decode() if isinstance(commit_id, bytes) else commit_id)
