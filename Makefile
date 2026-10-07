run:
	make -j 2 run-website run-app
.PHONY: run

run-website:
	cd apps/website && yarn dev
.PHONY: run-website

run-app:
	cd apps/app && yarn dev
.PHONY: run-app
