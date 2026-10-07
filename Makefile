run:
	make -j 2 run-website open-browser
.PHONY: run

run-website:
	cd apps/website && yarn dev
.PHONY: run-website

open-browser:
	open http://localhost:3000
.PHONY: open-browser
