#!/bin/bash
set -e

from="$1"
to="$2"
valid=true
if [ "$from" == "" ]; then
  valid=false
fi
if [ "$to" == "" ]; then
  valid=false
fi
if [ "$valid" == "false" ]; then
  echo "Usage: $0 <from> <to>"
  exit 1
fi

autoCompleteJs='<script src="https://cdn.jsdelivr.net/npm/@tarekraafat/autocomplete.js@10.2.10/dist/autoComplete.min.js" integrity="sha512-bIZLbsim/XCMC3W4awgVX/GJEoNhZ8TtLzX6RQ1KdfKR0xuJGzu7s8ND1VrG8PdZyqZsXJtfTe0kcUi2djaVPw==" crossOrigin="anonymous"></script>'
autoCompleteCss='<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tarekraafat/autocomplete.js@10.2.10/dist/css/autoComplete.min.css" integrity="sha512-xQY0CORvQDQE73Dwyz7VRaQ5D+EcZRKGcZrZqckuL2Gm90835BTx+T1cW2ljY0mGBvdBiKIkgwODPnMUAENArQ==" crossOrigin="anonymous">'

cat "$from" | sed -e "s|%INCLUDE-AUTOCOMPLETE%|${autoCompleteJs}\n${autoCompleteCss}|" > "$to"
