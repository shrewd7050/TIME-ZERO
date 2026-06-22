## after cloning the repo in a folder install follows these steps-

### 1: paste the following commands in terminal

##### Windows:

###### 

###### 

###### 1)python -m venv venv........install env

###### 2)venv\\Scripts\\activate.........activate it

#### 

#### macOS / Linux:





###### python3 -m venv venv

###### source venv/bin/activate



## 2:install independencies

###### pip install fastapi uvicorn sqlalchemy websockets



## 3:Run the server

###### uvicorn main:app --reload --host 0.0.0.0 --port 8000



