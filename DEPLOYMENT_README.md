# 🚀 Deployment Commands

```bash
./deploy-dev.sh
./deploy-prod.sh patch "Fix calendar icon styling"
./deploy-prod.sh minor "Add multi-assignee task system"  
./deploy-prod.sh major "Revolutionary UI redesign"
```

## Quick Reference

**Local Testing**: `./deploy-dev.sh` - Empty database, safe testing
**Production Deploy**: `./deploy-prod.sh [patch|minor|major] "message"` - Auto-versioning

**URLs:**
- Local: http://localhost:5173
- Production: https://crew.elbarriobk.com

**Note**: deploy-prod.sh deploys whatever you currently have in development to production with proper versioning.
