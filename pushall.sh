#!/bin/bash
git add .
git commit -m "$1"
git push origin main
git push frontend main
git push node main
