#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin, } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
.alias('c', 'command')
.describe('c', 'Command(s) to run')
.nargs('c', 1)
.help()
.alias('h', 'help')
.version()
.alias('v', 'version')
.argv
;
