# Group 1

## VAST Challenge MC3

### Planing 
We decided to work on the Mini-Challenge 3 of the VAST Challenge 2025.
For this we have to load the data into our neo4j database
Next we want to reduce the graph to a more compact version without losing any (important) information
Then we add some different visualization and filtering methods
Afterwards we add the possibility to compare views to find outliers, pseudonyms, etc.
We will somehow include the time variable to look at the time series part of the data
Nadia Conti has to be explored in more detail - is she maybe a part of the conspiracy?
At the end we should have a tool to analyse given data using visual analytic approach.

### Prototype
To use our prototype simply install Docker Desktop and NdeoJS (using npm) and clone this repository into Visual Studio Code.
Ensure that Docker works on youre computer. If you use Windows, download WSL (Linux for Windows) as well.

After setting everything up you can build the Docker images using "docker login" (make sure you use the same login credentials as in Docker Desktop) followed by "docker compose up --build" (or "docker compose build").
You should be able to see (in your terminal) that docker is building the images. This takes between 10 and 20 minutes - depending on your hardware. Next you should see that the backend and database are booting up. Wait for about 2-3 minutes then both the backend and database should be ready. Next open your Browser and type in the following url: http://localhost:3000/

This starts the frontend image which can also be observed in the terminal ("/comiling..."). When everything is ready the tool should load in your browser. It consists of a filter panel, node-link diagram, a communication view, bar plot, sankey diagram (this is not visible at the beginning) and a event view. 

The first time you start the apllication the database is probable empty. So your node-link diagram should be empty as well. Simply click the "Load JSON Graph" button on the upper right corner to load the data into the database. After it finished loading the graph should start its force simulation. Wait for the node-link diagram to finish its force simulation, only then can you start using the tool to its full potential.

If it doesn't load simply refresg the page (ctrl + r).

Have fun exploring the data :)

### How to use the tool
On how to use the tool you can watch our explanatory video here: https://cloud.uni-konstanz.de/index.php/s/tNQjgRFoAnYMnWm


### Troubleshooting
If you notice that the last step of building the docker images takes forever, you can also try to stop the building process (using ctrl + c) and then type "docker compose up" in your terminal without the build flag. If it still has to build the images, you can also try restarting your computer. 


## Old Read Me file content:

## Assignment 1 (separate task before VAST Challenge
The code is up to date and the PDF for exercise 2 is in the GROUP-1 folder: [Exercise 2](https://github.com/RealBenTen10/Vast-Challenge-2025-MC-3/edit/main/./AVA - Group 1 - Exercise 2.pdf)

## Using the template
This template contains a React frontend, a fastAPI backend, and a Neo4j database. Everything is dockerized, please do not change the overall setup or structure.
To run the application, follow these steps:


Requirements: You have Docker and NodeJS (npm) installed on your machine


Clone this repository with git clone [url].


Open a terminal/shell in the main directory (development-template) and run docker compose up. If it fails due to access issues, you might need to run docker login first and provide your DBVIS Gitlab credentials.


The website should be available at http://localhost:3000.
Other links:
Backend: http://localhost:8080
Neo4j Online Browser: http://localhost:7474/browser/
If not changed, the database credentials are
User: neo4j
Password: ava25-DB!!
More information will be presented in the course.
For questions, please contact Lucas Joos.

## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.dbvis.de/ava2025/group-1.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.dbvis.de/ava2025/group-1/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.

