#!/usr/bin/env node
import { main, readArguments, setExitCode } from "./effects/cli.js";

setExitCode(main(readArguments()));
