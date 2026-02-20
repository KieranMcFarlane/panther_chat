SHELL := /bin/bash

RALPH_DOCS_DIR ?= new-arch-docs/iteration-08
RALPH_OUT_DIR ?= output/ralph-wiggum/iteration-08
RALPH_TASKS ?= extract_entities extract_actions extract_constraints extract_sequences extract_io_contracts

.PHONY: ralph-wiggum
ralph-wiggum:
	@bash scripts/ralph-wiggum-loop.sh "$(RALPH_DOCS_DIR)" "$(RALPH_OUT_DIR)" "$(RALPH_TASKS)"

