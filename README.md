# convert-to-pdf

This lambda app still needs to be debugged.

You can try to invoke it locally using SAM:

```
sam local invoke --event SampleEvent1.json
```

The SampleEvent1.json file has the information of a sample S3 bucket and a sample file that the function will try to convert to a pdf and a docx file.

However, the libreoffice command is not working. This is strange becuase the command works if it is run from the command line in a Amazon Linux 2 testing environment.
