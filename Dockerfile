# Build the bundle with Bun, serve it from nginx.
#
# The runtime is pinned here rather than left to the build platform: Vite 7
# needs Node 20.19+, and a builder defaulting to an older runtime fails deep
# inside the CSS pipeline with an error that doesn't mention the version.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

# A transitive dependency (arbundles -> avsc) is locked to a git URL, so the
# builder needs git. Bun records it as git+ssh, which would demand SSH keys
# in CI for what is a public repository — rewrite those URLs to HTTPS so the
# install works with no credentials at all.
RUN apk add --no-cache git \
 && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
 && git config --global url."https://github.com/".insteadOf "git@github.com:"

# Dependencies first, so this layer is reused unless the lockfile changes.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# VITE_* values are read during the build and baked into the bundle, so they
# have to be present here — setting them at runtime has no effect.
ARG VITE_NODE_URL
ENV VITE_NODE_URL=$VITE_NODE_URL
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
