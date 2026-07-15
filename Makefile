.PHONY: help serve build clean

help:
	@echo "Available targets:"
	@echo "  make serve   Run Hugo dev server at http://localhost:1313 with drafts"
	@echo "  make build   Build the static site into ./public"
	@echo "  make clean   Remove generated ./public and Hugo cache"

serve:
	hugo server -D --disableFastRender

build:
	hugo --minify

clean:
	rm -rf public resources .hugo_build.lock
