FROM public.ecr.aws/lambda/python:3.12

# Install CPU-only runtime dependencies (boto3 is pre-installed in the Lambda Python 3.12 runtime;
# xgboost-cpu avoids pulling 345MB of unused NVIDIA CUDA GPU libraries into the CPU-only Lambda image)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir \
      pandas==2.2.1 \
      scikit-learn==1.5.0 \
      joblib==1.3.2 \
      "xgboost-cpu>=2.0.0" && \
    find /var/lang/lib/python3.12/site-packages -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true

# Copy the Lambda function code and model
COPY predict.py ${LAMBDA_TASK_ROOT}
COPY win_probability.py ${LAMBDA_TASK_ROOT}
COPY live_win_predictor_model.joblib ${LAMBDA_TASK_ROOT}
COPY live_metadata.json ${LAMBDA_TASK_ROOT}
COPY model_manifest.json ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "predict.handler" ]
