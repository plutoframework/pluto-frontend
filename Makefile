# Maintainer commands; application checks remain in pluto fmt/vet.
.DEFAULT_GOAL := help

.PHONY: help fmt vet check test

help:
	@echo "make fmt    - apply repository formatting"
	@echo "make vet    - check formatting, lint and build (no fixes)"
	@echo "make check  - run the standard repository checks and tests"
	@echo "make test   - run tests"

fmt:
	npm run fmt

vet:
	npm run check

check: vet

test:
	npm test
