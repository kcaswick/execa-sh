#!/bin/bash
echo ${SHELL} ${SHELL#/bin/} "$(echo foo; echo bar; echo baz)"
echo "$(( 2 * (4 - 1) )) equals 6 not 7"
