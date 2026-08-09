FROM jenkins/jenkins:lts-jdk21

COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

COPY --chown=jenkins:jenkins casc/jenkins.yaml /usr/share/jenkins/ref/casc/jenkins.yaml

