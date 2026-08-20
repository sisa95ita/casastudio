pipeline {
  agent {
    label 'casastudio-linux'
  }

  options {
    disableConcurrentBuilds()
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    timeout(time: 90, unit: 'MINUTES')
    skipDefaultCheckout(true)
  }

  environment {
    CI = 'true'
    COREPACK_ENABLE_PROJECT_SPEC = '1'
    DOCKER_BUILDKIT = '1'
    COMPOSE_DOCKER_CLI_BUILD = '1'
    PNPM_HOME = "${WORKSPACE}/.pnpm-home"
    PATH = "${WORKSPACE}/.pnpm-home:${PATH}"
    TURBO_TELEMETRY_DISABLED = '1'
    TURBO_CONCURRENCY = '1'
    CASASTUDIO_POSTGRES_PASSWORD = 'ci-compose-placeholder-not-secret'
    CASASTUDIO_TEST_POSTGRES_PASSWORD = 'ci-test-postgres-password'
    CASASTUDIO_KEYCLOAK_ADMIN_PASSWORD = 'ci-compose-placeholder-not-secret'
    CASASTUDIO_KEYCLOAK_API_CLIENT_SECRET = 'ci-compose-placeholder-not-secret'
    CASASTUDIO_KEYCLOAK_DEMO_PASSWORD = 'ci-compose-placeholder-not-secret'
    CASC_JENKINS_ADMIN_ID = 'ci-config-check'
    CASC_JENKINS_ADMIN_PASSWORD = 'ci-config-check-not-secret'
    CASC_JENKINS_AGENT_SECRET = 'ci-config-check-not-secret'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh '''
          set -eu
          git rev-parse --short=12 HEAD
          git status --short
        '''
        script {
          def requestedBuildVersion = env.CASASTUDIO_BUILD_VERSION?.trim()

          env.CASASTUDIO_DECLARED_VERSION = sh(
            returnStdout: true,
            script: 'node tools/build-version.mjs declared'
          ).trim()
          sh 'node tools/build-version.mjs assert-snapshot'

          if (requestedBuildVersion) {
            env.CASASTUDIO_BUILD_VERSION = requestedBuildVersion
            env.CASASTUDIO_BUILD_VERSION = sh(
              returnStdout: true,
              script: 'node tools/build-version.mjs resolve'
            ).trim()
          } else {
            env.CASASTUDIO_BUILD_VERSION = sh(
              returnStdout: true,
              script: 'node tools/build-version.mjs snapshot'
            ).trim()
          }

          echo "CasaStudio declared version: ${env.CASASTUDIO_DECLARED_VERSION}"
          echo "CasaStudio build version: ${env.CASASTUDIO_BUILD_VERSION}"
        }
      }
    }

    stage('Toolchain Verification') {
      steps {
        sh '''
          set -eu
          node --version | grep '^v24\\.'
          corepack --version
          corepack prepare pnpm@11.10.0 --activate
          pnpm --version | grep '^11\\.10\\.0$'
          git --version
          docker --version
          docker compose version
        '''
      }
    }

    stage('Install Dependencies') {
      steps {
        sh '''
          set -eu
          pnpm install --frozen-lockfile
          git diff --exit-code -- pnpm-lock.yaml
        '''
      }
    }

    stage('Repository Validation') {
      steps {
        sh '''
          set -eu
          pnpm lint
        '''
        sh '''
          set -eu
          pnpm test
        '''
        sh '''
          set -eu
          pnpm build
        '''
      }
    }

    stage('Schema') {
      steps {
        sh '''
          set -eu
          pnpm --filter @casastudio/schema lint
        '''
        sh '''
          set -eu
          pnpm --filter @casastudio/schema test --reporter=default --reporter=junit --outputFile.junit=../../test-results/schema/vitest.xml
        '''
        sh '''
          set -eu
          pnpm --filter @casastudio/schema build
        '''
        sh '''
          set -eu
          pnpm generate:schema
          git diff --exit-code -- packages/schema/json-schema/project.schema.json
        '''
      }
    }

    stage('Geometry') {
      steps {
        sh '''
          set -eu
          pnpm --filter @casastudio/geometry lint
        '''
        sh '''
          set -eu
          pnpm --filter @casastudio/geometry test --reporter=default --reporter=junit --outputFile.junit=../../test-results/geometry/vitest.xml
        '''
        sh '''
          set -eu
          pnpm --filter @casastudio/geometry build
        '''
      }
    }

    stage('Web') {
      steps {
        sh '''
          set -eu
          pnpm web:lint
        '''
        sh '''
          set -eu
          pnpm web:test --reporter=default --reporter=junit --outputFile.junit=../../test-results/web/vitest.xml
        '''
        sh '''
          set -eu
          pnpm web:build
        '''
      }
    }

    stage('API Static Validation') {
      steps {
        sh '''
          set -eu
          pnpm api:lint
        '''
        sh '''
          set -eu
          pnpm api:test --reporter=default --reporter=junit --outputFile.junit=../../test-results/api/vitest.xml
        '''
        sh '''
          set -eu
          pnpm api:build
        '''
        sh '''
          set -eu
          export DATABASE_URL="postgresql://casastudio:ci-config-check@localhost:5432/casastudio_ci?schema=public"
          pnpm db:validate
          pnpm db:generate
          git diff --exit-code -- apps/api/prisma/schema.prisma
        '''
      }
    }

    stage('API Database Integration') {
      steps {
        sh '''
          set -eu
          build_number="${BUILD_NUMBER:-0}"
          test_port="$((55432 + (build_number % 1000)))"
          project_name="casastudio-ci-${build_number}"

          export CASASTUDIO_TEST_POSTGRES_PORT="${test_port}"
          export COMPOSE_PROJECT_NAME="${project_name}"
          export DATABASE_URL="postgresql://casastudio:${CASASTUDIO_TEST_POSTGRES_PASSWORD}@host.docker.internal:${test_port}/casastudio_test?schema=public"

          docker compose -p "${project_name}" -f compose.yml -f compose.test.yml up -d postgres

          for attempt in $(seq 1 60); do
            if docker compose -p "${project_name}" -f compose.yml -f compose.test.yml exec -T postgres pg_isready -U casastudio -d casastudio_test; then
              break
            fi
            if [ "${attempt}" -eq 60 ]; then
              docker compose -p "${project_name}" -f compose.yml -f compose.test.yml logs postgres
              exit 1
            fi
            sleep 2
          done

          pnpm db:migrate:deploy
          pnpm api:test --reporter=default --reporter=junit --outputFile.junit=../../test-results/api-db/vitest.xml
        '''
      }
      post {
        always {
          sh '''
            set +u
            project_name="casastudio-ci-${BUILD_NUMBER:-0}"
            cleanup_status=0

            docker compose -p "${project_name}" -f compose.yml -f compose.test.yml down --volumes --remove-orphans || cleanup_status=$?

            if [ "${cleanup_status}" -ne 0 ]; then
              echo "API database integration cleanup reported failures. Review Docker access and any partial CI resources above."
            fi
            exit 0
          '''
        }
      }
    }

    stage('Compose Validation') {
      steps {
        sh '''
          set -eu
          docker compose config --quiet
          docker compose -f compose.yml -f compose.dev.yml config --quiet
          docker compose -f compose.yml -f compose.test.yml config --quiet
          docker compose -f compose.jenkins.yml config --quiet
        '''
      }
    }

    stage('Docker Image Build') {
      steps {
        sh '''
          set -eu
          : "${CASASTUDIO_BUILD_VERSION:?CasaStudio build version was not resolved}"
          docker build --target runtime -f apps/web/Dockerfile \
            --build-arg CASASTUDIO_BUILD_VERSION="${CASASTUDIO_BUILD_VERSION}" \
            -t "casastudio-web:${CASASTUDIO_BUILD_VERSION}" .
          docker build --target runtime -f apps/api/Dockerfile \
            -t "casastudio-api:${CASASTUDIO_BUILD_VERSION}" .
        '''
      }
    }
  }

  post {
    always {
      sh '''
        set +u
        project_name="casastudio-ci-${BUILD_NUMBER:-0}"
        image_tag="${CASASTUDIO_BUILD_VERSION:-}"
        cleanup_status=0

        docker compose -p "${project_name}" -f compose.yml -f compose.test.yml down --volumes --remove-orphans || cleanup_status=$?
        if [ -n "${image_tag}" ]; then
          for image in "casastudio-web:${image_tag}" "casastudio-api:${image_tag}"; do
            if docker image inspect "${image}" >/dev/null 2>&1; then
              docker image rm -f "${image}" || cleanup_status=$?
            fi
          done
        fi

        if [ "${cleanup_status}" -ne 0 ]; then
          echo "Post-build cleanup reported failures. Review Docker access and any partial CI resources above."
        fi
        exit 0
      '''
      junit allowEmptyResults: true, testResults: 'test-results/**/*.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'test-results/**, coverage/**'
      cleanWs deleteDirs: true, notFailBuild: true
    }
  }
}
