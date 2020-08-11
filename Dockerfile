FROM node:12.18.0-buster

RUN apt-get update
RUN apt-get install -y unzip wget curl apt-transport-https ca-certificates build-essential
RUN wget https://releases.hashicorp.com/terraform/0.12.18/terraform_0.12.18_linux_amd64.zip
RUN unzip terraform_0.12.18_linux_amd64.zip
RUN mv terraform /usr/local/bin/

RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3
RUN chmod 700 get_helm.sh 
RUN ./get_helm.sh 

# Download the Microsoft repository GPG keys
RUN wget -q https://packages.microsoft.com/config/debian/10/packages-microsoft-prod.deb

# Register the Microsoft repository GPG keys
RUN dpkg -i packages-microsoft-prod.deb

# Update the list of products
RUN apt-get update

# Install PowerShell
RUN apt-get install -y powershell


# replace shell with bash so we can source files
# RUN rm /bin/sh && ln -s /bin/bash /bin/sh

USER node
WORKDIR /home/node

RUN mkdir /home/node/.npm-global
ENV PATH=/home/node/.npm-global/bin:$PATH
# ENV NPM_CONFIG_PREFIX=/home/node/.npm-global

RUN helm repo add bitnami https://charts.bitnami.com/bitnami
RUN helm repo update


# confirm installation
RUN node -v
RUN npm -v

EXPOSE 3030

ADD . /home/node

RUN cd /home/node && npm install

#CMD npm install /home/node/app
RUN cd /home/node
CMD npm start /home/node