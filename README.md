
project-zomboid-construct
=========================

This will provide a project zomboid server runnning on EC2. Server configs will be generated at synth. It is assued you have a VPC and HostedZone to hook into.

The stack will provide the following:

* MultiPartUserData
  * Install system dependencies
  * Install game via steamcmd
  * Download file asstes from the cdk.Asset object types
  * Write, enable, and start a systemd unit file on `start-server.sh`
* A subdomain on the provided HostedZone
* Steam ingress rules
* An EC2 instance using all above

***Note***: As of this commit access is provided by IP address ingress rules. This will remain until I finish the networking portion.

### Context

I am using the Stack context to provide config, this will likely change. Your app would need the following:

```
    environment: {
      example: {
        region: "us-east-1",
        ami: "ami-0123456789abcdefg",
        subdomain: "sub",
        servername: "example"
      },
      ...
    },
```
