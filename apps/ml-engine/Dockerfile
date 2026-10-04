FROM public.ecr.aws/lambda/python:3.10

# Copy requirements.txt
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install dependencies
RUN pip install -r requirements.txt

# Copy the Lambda function code and model
COPY predict.py ${LAMBDA_TASK_ROOT}
COPY live_win_predictor_model.joblib ${LAMBDA_TASK_ROOT}
COPY live_metadata.json ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "predict.handler" ]
