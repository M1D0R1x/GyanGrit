# Useful Dev Commands

## Database Backup
pg_dump -h aws-1-ap-south-1.pooler.supabase.com -U postgres.rvyuccwggicloiyoixjb -d postgres -Fc > gyangrit_backup.dump

## Project Tree
tree backend frontend docs \
  -I "node_modules|__pycache__|*.pyc|*.pyo|*.pyd|staticfiles|dist|build|.git|.DS_Store" \
  > project_structure_clean.txt